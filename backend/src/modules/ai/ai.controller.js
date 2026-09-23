const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./ai.service');

// ctx canónico: companyId/permissions SOLO del JWT + scopeCompany (nunca del body)
const ctx = (req) => ({
  userId: req.user.id,
  companyId: req.companyId,
  role: req.user.role,
  permissions: req.user.permissions,
  userName: req.user.name,
  ip: req.ip
});

const chat = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.chat(ctx(req), req.body) });
});

const analyze = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.analyze(ctx(req), req.body) });
});

const health = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.health() });
});

module.exports = { chat, analyze, health };
