const repo = require('./contact.repository');
const customerRepo = require('./customer.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED_CREATE = ['name', 'email', 'phone', 'position', 'isPrimary'];
const ALLOWED_UPDATE = ['name', 'email', 'phone', 'position', 'isPrimary'];

function pick(obj, keys) {
  const r = {};
  for (const k of keys) if (obj[k] !== undefined) r[k] = obj[k];
  return r;
}

async function create(customerId, data, ctx) {
  const customer = await customerRepo.findById(customerId);
  if (!customer || String(customer.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  const safe = pick(data, ALLOWED_CREATE);
  safe.companyId = ctx.companyId;
  safe.customerId = customerId;
  const contact = await repo.create(safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'crm.contacts', documentId: String(contact._id), newData: { name: contact.name }, ip: ctx.ip });
  return contact;
}

async function listByCustomer(customerId, ctx, query) {
  const customer = await customerRepo.findById(customerId);
  if (!customer || String(customer.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  return repo.listByCustomer(ctx.companyId, customerId, query);
}

async function getById(id, ctx) {
  const contact = await repo.findById(id);
  if (!contact || String(contact.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Contacto no encontrado', 'CONTACT_NOT_FOUND');
  return contact;
}

async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Contacto no encontrado', 'CONTACT_NOT_FOUND');
  const safe = pick(data, ALLOWED_UPDATE);
  const updated = await repo.update(id, safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'crm.contacts', documentId: id, previousData: { name: prev.name }, newData: safe, ip: ctx.ip });
  return updated;
}

async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Contacto no encontrado', 'CONTACT_NOT_FOUND');
  await repo.remove(id);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'DELETE', module: 'crm.contacts', documentId: id, previousData: { name: prev.name }, ip: ctx.ip });
  return { deleted: true };
}

module.exports = { create, listByCustomer, getById, update, remove };
