const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./sales.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, branchId: req.body?.branchId || null, ip: req.ip });

// Quotes
const createQuote = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createQuote(req.body, ctx(req)) }); });
const listQuotes = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listQuotes(ctx(req), req.query) }); });
const approveQuote = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.approveQuote(req.params.id, ctx(req)) }); });

// Orders
const createOrderFromQuote = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createOrderFromQuote(req.params.quoteId, ctx(req)) }); });
const listOrders = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listOrders(ctx(req), req.query) }); });
const updateOrderStatus = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateOrderStatus(req.params.id, req.body.status, ctx(req)) }); });

// Invoices
const createInvoiceFromOrder = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createInvoiceFromOrder(req.params.orderId, ctx(req)) }); });
const listInvoices = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listInvoices(ctx(req), req.query) }); });

// Payments
const registerPayment = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.registerPayment(req.params.invoiceId, req.body, ctx(req)) }); });
const listPayments = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listPayments(ctx(req), req.query) }); });

module.exports = { createQuote, listQuotes, approveQuote, createOrderFromQuote, listOrders, updateOrderStatus, createInvoiceFromOrder, listInvoices, registerPayment, listPayments };
