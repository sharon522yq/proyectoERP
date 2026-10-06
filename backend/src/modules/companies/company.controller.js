const { asyncHandler } = require('../../utils/ApiError');
const service = require('./company.service');

const ctxOf = (req) => ({ userId: req.user.id, companyId: req.companyId, permissions: req.user.permissions, ip: req.ip });

const create = asyncHandler(async (req, res) => {
  const company = await service.create(req.body, ctxOf(req));
  res.status(201).json({ success: true, data: company });
});
const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(ctxOf(req)) });
});
const getById = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.params.id, ctxOf(req)) });
});
const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.update(req.params.id, req.body, ctxOf(req)) });
});

module.exports = { create, list, getById, update };
