const repo = require('./sales.repository');
const customerRepo = require('../crm/customer.repository');
const productRepo = require('../products/product.repository');
const inventoryService = require('../inventory/inventory.service');
const financeService = require('../finance/finance.service');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

// D-007: matriz de transiciones de estado del pedido de venta.
// La salida de stock ocurre exactamente una vez (al entrar en CONFIRMED),
// por eso CONFIRMED no admite re-entradas ni cancelación posterior
// (una cancelación tras confirmación requerirá módulo de devoluciones).
const ORDER_TRANSITIONS = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'SHIPPED', 'DELIVERED'],
  PREPARING: ['SHIPPED', 'DELIVERED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

async function assertProductsInCompany(items, companyId) {
  for (const item of items) {
    const product = await productRepo.findById(item.productId);
    if (!product || String(product.companyId) !== String(companyId)) {
      throw new ApiError(404, `Producto no encontrado: ${item.productId}`, 'PRODUCT_NOT_FOUND');
    }
  }
}

async function resolveWarehouse(ctx) {
  const warehouses = await inventoryService.listWarehouses(ctx);
  if (!warehouses.length) {
    throw new ApiError(400, 'La empresa no tiene almacenes configurados; crea uno antes de confirmar pedidos', 'WAREHOUSE_REQUIRED');
  }
  return warehouses[0];
}

// Salida automática de stock por pedido confirmado (agrupada por producto,
// con pre-validación total para evitar salidas parciales).
async function releaseStock(order, ctx) {
  const warehouse = await resolveWarehouse(ctx);
  const grouped = new Map();
  for (const item of order.items) {
    const key = String(item.productId);
    grouped.set(key, (grouped.get(key) || 0) + item.quantity);
  }
  const requirements = [...grouped].map(([productId, quantity]) => ({ productId, quantity }));
  await inventoryService.assertStockAvailable(ctx, warehouse._id, requirements);
  for (const req of requirements) {
    await inventoryService.adjustStock(
      req.productId, warehouse._id, req.quantity, 'SALE_EXIT',
      `Salida automática por pedido ${order.folio}`, ctx,
      { referenceType: 'SALES_ORDER', referenceId: order._id }
    );
  }
}

function calcTotals(items) {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;
  for (const item of items) {
    const line = item.quantity * item.unitPrice;
    const disc = item.discount || 0;
    const net = line - disc;
    const tax = net * (item.taxRate || 0) / 100;
    item.subtotal = net;
    subtotal += net;
    discountTotal += disc;
    taxTotal += tax;
  }
  return { subtotal, discountTotal, taxTotal, total: subtotal + taxTotal };
}

// ---- Quotes ----
async function createQuote(data, ctx) {
  if (!data.customerId || !data.items || !data.items.length) throw new ApiError(400, 'customerId e items son requeridos', 'VALIDATION_ERROR');
  const customer = await customerRepo.findById(data.customerId);
  if (!customer || String(customer.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  await assertProductsInCompany(data.items, ctx.companyId);
  const folio = await repo.nextFolio(ctx.companyId, 'COT');
  const totals = calcTotals(data.items);
  const quote = await repo.createQuote({ ...data, ...totals, folio, companyId: ctx.companyId, branchId: ctx.branchId, assignedTo: ctx.userId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'sales.quotes', documentId: String(quote._id), newData: { folio, total: quote.total }, ip: ctx.ip });
  return quote;
}

async function listQuotes(ctx, query) { return repo.listQuotes(ctx.companyId, query); }

async function approveQuote(id, ctx) {
  const quote = await repo.findQuoteById(id);
  if (!quote || String(quote.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND');
  if (quote.status !== 'SENT' && quote.status !== 'DRAFT') throw new ApiError(400, 'Solo se pueden aprobar cotizaciones en estado DRAFT o SENT', 'INVALID_STATUS');
  const updated = await repo.updateQuote(id, { status: 'APPROVED' });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'sales.quotes', documentId: id, newData: { status: 'APPROVED' }, ip: ctx.ip });
  return updated;
}

// ---- Sales Orders ----
async function createOrderFromQuote(quoteId, ctx) {
  const quote = await repo.findQuoteById(quoteId);
  if (!quote || String(quote.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cotización no encontrada', 'QUOTE_NOT_FOUND');
  if (quote.status !== 'APPROVED') throw new ApiError(400, 'La cotización debe estar aprobada', 'QUOTE_NOT_APPROVED');
  const folio = await repo.nextFolio(ctx.companyId, 'PED');
  const order = await repo.createOrder({
    folio, quoteId, customerId: quote.customerId, items: quote.items,
    subtotal: quote.subtotal, discountTotal: quote.discountTotal, taxTotal: quote.taxTotal, total: quote.total,
    currency: quote.currency, companyId: ctx.companyId, branchId: ctx.branchId, assignedTo: ctx.userId
  });
  await repo.updateQuote(quoteId, { status: 'CONVERTED' });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'sales.orders', documentId: String(order._id), newData: { folio }, ip: ctx.ip });
  return order;
}

async function listOrders(ctx, query) { return repo.listOrders(ctx.companyId, query); }

async function updateOrderStatus(id, status, ctx) {
  const order = await repo.findOrderById(id);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Pedido no encontrado', 'ORDER_NOT_FOUND');
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Transición de estado inválida: ${order.status} → ${status || '(vacío)'}`, 'INVALID_STATUS_TRANSITION');
  }
  if (status === 'CONFIRMED') await releaseStock(order, ctx);
  const updated = await repo.updateOrder(id, { status });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'sales.orders', documentId: id, previousData: { status: order.status }, newData: { status }, ip: ctx.ip });
  return updated;
}

// ---- Invoices ----
async function createInvoiceFromOrder(orderId, ctx) {
  const order = await repo.findOrderById(orderId);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Pedido no encontrado', 'ORDER_NOT_FOUND');
  if (!['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(order.status)) throw new ApiError(400, 'El pedido debe estar confirmado', 'ORDER_NOT_CONFIRMED');
  const folio = await repo.nextFolio(ctx.companyId, 'FAC');
  const invoice = await repo.createInvoice({
    folio, salesOrderId: order._id, customerId: order.customerId, items: order.items,
    subtotal: order.subtotal, discountTotal: order.discountTotal, taxTotal: order.taxTotal, total: order.total,
    currency: order.currency, companyId: ctx.companyId, branchId: ctx.branchId,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  // Enlace con Finanzas (D-010): la factura genera Cuentas por Cobrar
  await financeService.postSystemTransaction({
    companyId: ctx.companyId, branchId: ctx.branchId, userId: ctx.userId,
    accountCode: '1200', accountName: 'Cuentas por cobrar', accountType: 'ASSET',
    type: 'INCOME', amount: invoice.total,
    description: `Factura ${folio} por pedido ${order.folio}`,
    referenceType: 'SALES_INVOICE', referenceId: invoice._id, category: 'VENTAS'
  });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'sales.invoices', documentId: String(invoice._id), newData: { folio }, ip: ctx.ip });
  return invoice;
}

async function listInvoices(ctx, query) { return repo.listInvoices(ctx.companyId, query); }

// ---- Payments ----
async function registerPayment(invoiceId, data, ctx) {
  const invoice = await repo.findInvoiceById(invoiceId);
  if (!invoice || String(invoice.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Factura no encontrada', 'INVOICE_NOT_FOUND');
  if (invoice.status === 'PAID') throw new ApiError(400, 'Factura ya pagada', 'INVOICE_ALREADY_PAID');
  if (data.amount > (invoice.total - invoice.paidAmount)) throw new ApiError(400, 'El monto excede el saldo pendiente', 'AMOUNT_EXCEEDS');

  const folio = await repo.nextFolio(ctx.companyId, 'PAG');
  const payment = await repo.createPayment({ ...data, folio, invoiceId, customerId: invoice.customerId, companyId: ctx.companyId, branchId: ctx.branchId, receivedBy: ctx.userId });

  const newPaid = invoice.paidAmount + data.amount;
  const newStatus = newPaid >= invoice.total ? 'PAID' : 'PARTIAL';
  await repo.updateInvoice(invoiceId, { paidAmount: newPaid, status: newStatus });

  // Enlace con Finanzas (D-010): el pago acredita caja y reduce Cuentas por Cobrar
  await financeService.postSystemTransaction({
    companyId: ctx.companyId, branchId: ctx.branchId, userId: ctx.userId,
    accountCode: '1000', accountName: 'Caja y bancos', accountType: 'ASSET',
    type: 'INCOME', amount: data.amount,
    description: `Pago ${folio} de factura ${invoice.folio}`,
    referenceType: 'PAYMENT', referenceId: payment._id, category: 'COBRANZA'
  });
  await financeService.postSystemTransaction({
    companyId: ctx.companyId, branchId: ctx.branchId, userId: ctx.userId,
    accountCode: '1200', accountName: 'Cuentas por cobrar', accountType: 'ASSET',
    type: 'EXPENSE', amount: data.amount,
    description: `Abono a CxC por pago ${folio} de factura ${invoice.folio}`,
    referenceType: 'PAYMENT', referenceId: payment._id, category: 'COBRANZA'
  });

  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'sales.payments', documentId: String(payment._id), newData: { folio, amount: data.amount }, ip: ctx.ip });
  return payment;
}

async function listPayments(ctx, query) { return repo.listPayments(ctx.companyId, query); }

module.exports = { createQuote, listQuotes, approveQuote, createOrderFromQuote, listOrders, updateOrderStatus, createInvoiceFromOrder, listInvoices, registerPayment, listPayments };
