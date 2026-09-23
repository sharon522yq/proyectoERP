const { asyncHandler } = require('../../utils/ApiError');
const service = require('./user.service');

const ctxOf = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.create(req.body, ctxOf(req)) });
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
const remove = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.remove(req.params.id, ctxOf(req)) });
});

module.exports = { create, list, getById, update, remove };
