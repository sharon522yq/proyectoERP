const repo = require('./customer.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED_CREATE = ['name', 'email', 'phone', 'address', 'taxId', 'type', 'status', 'assignedTo', 'notes'];
const ALLOWED_UPDATE = ['name', 'email', 'phone', 'address', 'taxId', 'type', 'status', 'assignedTo', 'notes'];

function pick(obj, keys) {
  const r = {};
  for (const k of keys) if (obj[k] !== undefined) r[k] = obj[k];
  return r;
}

async function create(data, ctx) {
  const safe = pick(data, ALLOWED_CREATE);
  safe.companyId = ctx.companyId;
  if (ctx.branchId) safe.branchId = ctx.branchId;
  const customer = await repo.create(safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'crm.customers', documentId: String(customer._id), newData: { name: customer.name }, ip: ctx.ip });
  return customer;
}

async function list(ctx, query) {
  return repo.list(ctx.companyId, query);
}

async function getById(id, ctx) {
  const customer = await repo.findById(id);
  if (!customer || String(customer.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  return customer;
}

async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  const safe = pick(data, ALLOWED_UPDATE);
  const updated = await repo.update(id, safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'crm.customers', documentId: id, previousData: { name: prev.name }, newData: safe, ip: ctx.ip });
  return updated;
}

async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  await repo.remove(id);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'DELETE', module: 'crm.customers', documentId: id, previousData: { name: prev.name }, ip: ctx.ip });
  return { deleted: true };
}

module.exports = { create, list, getById, update, remove };
