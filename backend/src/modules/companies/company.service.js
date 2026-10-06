const { assertCompany, isGlobal } = require('../../utils/companyAccess');
const User = require('../users/user.model');
const repo = require('./company.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED_UPDATE_FIELDS = ['name', 'taxId', 'email', 'active'];

async function create(data, ctx) {
  if (!isGlobal(ctx) && ctx.companyId) throw new ApiError(403, 'Solo administración global puede crear otra empresa', 'FORBIDDEN');
  const company = await repo.create({ name: data.name, taxId: data.taxId, email: data.email });
  if (!isGlobal(ctx)) await User.updateOne({ _id: ctx.userId, companyId: null }, { $set: { companyId: company._id } });
  await logAudit({ userId: ctx.userId, companyId: company._id, action: 'CREATE', module: 'companies', documentId: String(company._id), newData: { name: company.name }, ip: ctx.ip });
  return company;
}
async function list(ctx) {
  if (isGlobal(ctx)) return repo.list();
  if (!ctx.companyId) return [];
  return [await getById(ctx.companyId, ctx)];
}
async function getById(id, ctx) {
  assertCompany(ctx, id);
  const company = await repo.getById(id);
  if (!company) throw new ApiError(404, 'Empresa no encontrada', 'COMPANY_NOT_FOUND');
  return company;
}
async function update(id, data, ctx) {
  assertCompany(ctx, id);
  const prev = await repo.getById(id);
  if (!prev) throw new ApiError(404, 'Empresa no encontrada', 'COMPANY_NOT_FOUND');
  const safe = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (data[key] !== undefined) safe[key] = data[key];
  }
  const updated = await repo.update(id, safe);
  await logAudit({ userId: ctx.userId, companyId: prev._id, action: 'UPDATE', module: 'companies', documentId: id, previousData: { name: prev.name }, newData: safe, ip: ctx.ip });
  return updated;
}

module.exports = { create, list, getById, update };
