const Quote = require('./quote.model');
const SalesOrder = require('./salesOrder.model');
const Invoice = require('./invoice.model');
const Payment = require('./payment.model');

// Quotes
async function createQuote(data) { return Quote.create(data); }
async function findQuoteById(id) { return Quote.findById(id); }
async function listQuotes(companyId, { page = 1, limit = 20, status } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quote.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateQuote(id, data) {
  await Quote.updateOne({ _id: id }, { $set: data });
  return Quote.findById(id);
}

// Sales Orders
async function createOrder(data) { return SalesOrder.create(data); }
async function findOrderById(id) { return SalesOrder.findById(id); }
async function listOrders(companyId, { page = 1, limit = 20, status } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    SalesOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SalesOrder.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateOrder(id, data) {
  await SalesOrder.updateOne({ _id: id }, { $set: data });
  return SalesOrder.findById(id);
}

// Invoices
async function createInvoice(data) { return Invoice.create(data); }
async function findInvoiceById(id) { return Invoice.findById(id); }
async function listInvoices(companyId, { page = 1, limit = 20, status } = {}) {
  const filter = { companyId, deletedAt: null };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateInvoice(id, data) {
  await Invoice.updateOne({ _id: id }, { $set: data });
  return Invoice.findById(id);
}

// Payments
async function createPayment(data) { return Payment.create(data); }
async function findPaymentById(id) { return Payment.findById(id); }
async function listPayments(companyId, { page = 1, limit = 20, invoiceId } = {}) {
  const filter = { companyId };
  if (invoiceId) filter.invoiceId = invoiceId;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

// Folio generation (per company, sequential)
async function nextFolio(companyId, prefix) {
  const counter = await require('mongoose').connection.collection('counters');
  const result = await counter.findOneAndUpdate(
    { _id: `${companyId}_${prefix}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return `${prefix}-${String(result.seq).padStart(6, '0')}`;
}

module.exports = {
  createQuote, findQuoteById, listQuotes, updateQuote,
  createOrder, findOrderById, listOrders, updateOrder,
  createInvoice, findInvoiceById, listInvoices, updateInvoice,
  createPayment, findPaymentById, listPayments, nextFolio
};
