const repo = require('./category.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

async function create(data, ctx) {
  const category = await repo.create({ ...data, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'categories', documentId: String(category._id), newData: { name: category.name }, ip: ctx.ip });
  return category;
}
async function list(ctx, query) { return repo.list(ctx.companyId, query); }
async function getById(id, ctx) {
  const cat = await repo.findById(id);
  if (!cat || String(cat.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Categoría no encontrada', 'CATEGORY_NOT_FOUND');
  return cat;
}
async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Categoría no encontrada', 'CATEGORY_NOT_FOUND');
  const updated = await repo.update(id, { name: data.name, description: data.description, parentId: data.parentId, active: data.active });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'categories', documentId: id, previousData: { name: prev.name }, newData: { name: data.name }, ip: ctx.ip });
  return updated;
}
async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Categoría no encontrada', 'CATEGORY_NOT_FOUND');
  await repo.remove(id);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'DELETE', module: 'categories', documentId: id, previousData: { name: prev.name }, ip: ctx.ip });
  return { deleted: true };
}

module.exports = { create, list, getById, update, remove };
