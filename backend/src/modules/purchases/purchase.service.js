const repo = require('./purchase.repository');
const customerRepo = require('../crm/customer.repository');
const productRepo = require('../products/product.repository');
const inventoryService = require('../inventory/inventory.service');
const financeService = require('../finance/finance.service');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

// D-007: matriz de transiciones de estado de la orden de compra.
// El alta de stock ocurre exactamente una vez (al entrar en RECEIVED).
const ORDER_TRANSITIONS = {
  DRAFT: ['SENT', 'CONFIRMED', 'CANCELLED'],
  SENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: []
};

async function create(data, ctx) {
  if (!data.supplierId || !data.items || !data.items.length) throw new ApiError(400, 'supplierId e items son requeridos', 'VALIDATION_ERROR');
  const supplier = await customerRepo.findById(data.supplierId);
  if (!supplier || String(supplier.companyId) !== String(ctx.companyId)) {
    throw new ApiError(404, 'Proveedor no encontrado', 'SUPPLIER_NOT_FOUND');
  }
  for (const item of data.items) {
    const product = await productRepo.findById(item.productId);
    if (!product || product.status !== 'ACTIVE' || String(product.companyId) !== String(ctx.companyId)) {
      throw new ApiError(404, `Producto no encontrado: ${item.productId}`, 'PRODUCT_NOT_FOUND');
    }
  }
  const folio = await repo.nextFolio(ctx.companyId, 'OC');
  let subtotal = 0;
  for (const item of data.items) {
    item.subtotal = item.quantity * item.unitCost;
    subtotal += item.subtotal;
  }
  const taxTotal = data.items.reduce((sum, i) => sum + i.subtotal * (i.taxRate || 0) / 100, 0);
  const order = await repo.create({
    ...data, folio, subtotal, taxTotal, total: subtotal + taxTotal,
    companyId: ctx.companyId, branchId: ctx.branchId, requestedBy: ctx.userId
  });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'purchases.orders', documentId: String(order._id), newData: { folio, total: order.total }, ip: ctx.ip });
  return order;
}

async function list(ctx, query) { return repo.list(ctx.companyId, query); }

// Alta automática de stock al recibir la compra (agrupado por producto, en el
// almacén por defecto de la empresa), con trazabilidad hacia la orden (D-010).
async function receiveStock(order, ctx) {
  const warehouses = (await inventoryService.listWarehouses(ctx)).filter(w => w.active);
  if (!warehouses.length) {
    throw new ApiError(400, 'La empresa no tiene almacenes configurados; crea uno antes de recibir compras', 'WAREHOUSE_REQUIRED');
  }
  const warehouse = warehouses[0];
  const grouped = new Map();
  for (const item of order.items) {
    const key = String(item.productId);
    grouped.set(key, (grouped.get(key) || 0) + item.quantity);
  }
  for (const [productId, quantity] of grouped) {
    await inventoryService.adjustStock(
      productId, warehouse._id, quantity, 'PURCHASE_ENTRY',
      `Entrada automática por recepción de compra ${order.folio}`, ctx,
      { referenceType: 'PURCHASE_ORDER', referenceId: order._id }
    );
  }
}

async function updateStatus(id, status, ctx) {
  const order = await repo.findById(id);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Orden de compra no encontrada', 'PURCHASE_ORDER_NOT_FOUND');
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Transición de estado inválida: ${order.status} → ${status || '(vacío)'}`, 'INVALID_STATUS_TRANSITION');
  }
  if (status === 'RECEIVED') {
    await receiveStock(order, ctx);
    // Enlace con Finanzas (D-010): la recepción reconoce Cuentas por Pagar
    await financeService.postSystemTransaction({
      companyId: ctx.companyId, branchId: ctx.branchId, userId: ctx.userId,
      accountCode: '2100', accountName: 'Cuentas por pagar', accountType: 'LIABILITY',
      type: 'INCOME', amount: order.total,
      description: `Recepción de compra ${order.folio}`,
      referenceType: 'PURCHASE_ORDER', referenceId: order._id, category: 'COMPRAS'
    });
  }
  const updated = await repo.update(id, { status });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'purchases.orders', documentId: id, previousData: { status: order.status }, newData: { status }, ip: ctx.ip });
  return updated;
}

module.exports = { create, list, updateStatus };
