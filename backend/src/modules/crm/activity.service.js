const repo = require('./activity.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED_CREATE = ['leadId', 'customerId', 'type', 'subject', 'description', 'date', 'dueDate', 'status', 'assignedTo'];
const ALLOWED_UPDATE = ['type', 'subject', 'description', 'date', 'dueDate', 'status', 'outcome'];

function pick(obj, keys) {
  const r = {};
  for (const k of keys) if (obj[k] !== undefined) r[k] = obj[k];
  return r;
}

async function create(data, ctx) {
  const safe = pick(data, ALLOWED_CREATE);
  safe.companyId = ctx.companyId;
  const activity = await repo.create(safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'crm.activities', documentId: String(activity._id), newData: { subject: activity.subject, type: activity.type }, ip: ctx.ip });
  return activity;
}

async function list(ctx, query) {
  return repo.list(ctx.companyId, query);
}

async function getById(id, ctx) {
  const activity = await repo.findById(id);
  if (!activity || String(activity.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Actividad no encontrada', 'ACTIVITY_NOT_FOUND');
  return activity;
}

async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Actividad no encontrada', 'ACTIVITY_NOT_FOUND');
  const safe = pick(data, ALLOWED_UPDATE);
  const updated = await repo.update(id, safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'crm.activities', documentId: id, previousData: { subject: prev.subject }, newData: safe, ip: ctx.ip });
  return updated;
}

async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Actividad no encontrada', 'ACTIVITY_NOT_FOUND');
  await repo.remove(id);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'DELETE', module: 'crm.activities', documentId: id, previousData: { subject: prev.subject }, ip: ctx.ip });
  return { deleted: true };
}

module.exports = { create, list, getById, update, remove };
