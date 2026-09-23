const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./finance.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, branchId: req.body?.branchId || null, ip: req.ip });

const createAccount = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createAccount(req.body, ctx(req)) }); });
const listAccounts = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listAccounts(ctx(req), req.query) }); });
const getAccount = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getAccount(req.params.id, ctx(req)) }); });
const createTransaction = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createTransaction(req.body, ctx(req)) }); });
const listTransactions = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listTransactions(ctx(req), req.query) }); });
const getSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getSummary(ctx(req)) }); });

module.exports = { createAccount, listAccounts, getAccount, createTransaction, listTransactions, getSummary };
