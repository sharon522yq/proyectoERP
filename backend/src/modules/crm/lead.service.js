const repo = require('./lead.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED_CREATE = ['name', 'email', 'phone', 'company', 'source', 'status', 'priority', 'assignedTo', 'notes', 'estimatedValue'];
const ALLOWED_UPDATE = ['name', 'email', 'phone', 'company', 'source', 'status', 'priority', 'assignedTo', 'notes', 'estimatedValue'];

function pick(obj, keys) {
  const r = {};
  for (const k of keys) if (obj[k] !== undefined) r[k] = obj[k];
  return r;
}

async function create(data, ctx) {
  const safe = pick(data, ALLOWED_CREATE);
  safe.companyId = ctx.companyId;
  if (ctx.branchId) safe.branchId = ctx.branchId;
  const lead = await repo.create(safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'crm.leads', documentId: String(lead._id), newData: { name: lead.name }, ip: ctx.ip });
  return lead;
}

async function list(ctx, query) {
  return repo.list(ctx.companyId, query);
}

async function getById(id, ctx) {
  const lead = await repo.findById(id);
  if (!lead || String(lead.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Lead no encontrado', 'LEAD_NOT_FOUND');
  return lead;
}

async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Lead no encontrado', 'LEAD_NOT_FOUND');
  const safe = pick(data, ALLOWED_UPDATE);
  const updated = await repo.update(id, safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'crm.leads', documentId: id, previousData: { name: prev.name, status: prev.status }, newData: safe, ip: ctx.ip });
  return updated;
}

async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Lead no encontrado', 'LEAD_NOT_FOUND');
  await repo.remove(id);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'DELETE', module: 'crm.leads', documentId: id, previousData: { name: prev.name }, ip: ctx.ip });
  return { deleted: true };
}

async function convertToCustomer(id, ctx) {
  const lead = await repo.findById(id);
  if (!lead || String(lead.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Lead no encontrado', 'LEAD_NOT_FOUND');
  if (lead.status === 'WON' && lead.customerId) throw new ApiError(400, 'Lead ya convertido', 'LEAD_ALREADY_CONVERTED');

  const customerRepo = require('./customer.repository');
  const customer = await customerRepo.create({
    companyId: ctx.companyId,
    branchId: lead.branchId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    type: 'BUSINESS',
    status: 'ACTIVE',
    assignedTo: lead.assignedTo,
    leadId: lead._id
  });

  await repo.update(id, { status: 'WON', convertedAt: new Date(), customerId: customer._id });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'crm.leads', documentId: id, newData: { status: 'WON', customerId: String(customer._id) }, ip: ctx.ip });
  return customer;
}

module.exports = { create, list, getById, update, remove, convertToCustomer };
