const repo = require('./branch.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

function assertSameCompany(reqCompanyId, targetCompanyId, isSuperAdmin) {
  if (isSuperAdmin) return;
  if (!reqCompanyId || String(reqCompanyId) !== String(targetCompanyId)) {
    throw new ApiError(403, 'Acceso denegado a otra empresa', 'CROSS_COMPANY');
  }
}

async function create(data, ctx) {
  const isSuper = ctx.permissions.includes('*');
  assertSameCompany(ctx.companyId, data.companyId, isSuper);
  const branch = await repo.create(data);
  await logAudit({ userId: ctx.userId, companyId: data.companyId, action: 'CREATE', module: 'branches', documentId: String(branch._id), newData: data, ip: ctx.ip });
  return branch;
}

async function list(ctx) {
  const companyId = ctx.companyId || ctx.queryCompanyId;
  if (!companyId) throw new ApiError(400, 'companyId requerido', 'VALIDATION_ERROR');
  return repo.listByCompany(companyId);
}

async function getById(id, ctx) {
  const branch = await repo.getById(id);
  if (!branch) throw new ApiError(404, 'Sucursal no encontrada', 'BRANCH_NOT_FOUND');
  const isSuper = ctx.permissions.includes('*');
  assertSameCompany(ctx.companyId, branch.companyId, isSuper);
  return branch;
}

async function update(id, data, ctx) {
  const prev = await repo.getById(id);
  if (!prev) throw new ApiError(404, 'Sucursal no encontrada', 'BRANCH_NOT_FOUND');
  const isSuper = ctx.permissions.includes('*');
  assertSameCompany(ctx.companyId, prev.companyId, isSuper);
  const updated = await repo.update(id, data);
  await logAudit({ userId: ctx.userId, companyId: prev.companyId, action: 'UPDATE', module: 'branches', documentId: id, previousData: prev.toObject(), newData: data, ip: ctx.ip });
  return updated;
}

module.exports = { create, list, getById, update };
