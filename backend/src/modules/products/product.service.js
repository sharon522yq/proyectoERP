const repo = require('./product.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED = ['sku', 'name', 'description', 'categoryId', 'unitId', 'cost', 'price', 'currency', 'taxRate', 'minimumStock', 'maximumStock', 'status'];

async function validateReferences(data, ctx) {
  if (data.categoryId !== undefined) {
    const category = await require('./category.model').findOne({ _id: data.categoryId, companyId: ctx.companyId, active: true, deletedAt: null });
    if (!category) throw new ApiError(404, 'Categoría activa no encontrada en esta empresa', 'CATEGORY_NOT_FOUND');
  }
  // Las unidades son un catálogo global, no pertenecen a un tenant.
  if (data.unitId !== undefined && !await require('./unit.model').exists({ _id: data.unitId })) {
    throw new ApiError(404, 'Unidad de medida no encontrada', 'UNIT_NOT_FOUND');
  }
}

function pick(obj, keys) {
  const r = {};
  for (const k of keys) if (obj[k] !== undefined) r[k] = obj[k];
  return r;
}

async function create(data, ctx) {
  const safe = pick(data, ALLOWED);
  safe.companyId = ctx.companyId;
  await validateReferences(safe, ctx);
  if (!safe.sku) throw new ApiError(400, 'SKU es requerido', 'VALIDATION_ERROR');
  const existing = await repo.findBySku(ctx.companyId, safe.sku);
  if (existing) throw new ApiError(409, 'SKU ya existe en esta empresa', 'SKU_TAKEN');
  const product = await repo.create(safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'products', documentId: String(product._id), newData: { sku: product.sku, name: product.name }, ip: ctx.ip });
  return product;
}

async function list(ctx, query) { return repo.list(ctx.companyId, query); }

async function getById(id, ctx) {
  const product = await repo.findById(id);
  if (!product || String(product.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
  return product;
}

async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
  const safe = pick(data, ALLOWED);
  await validateReferences(safe, ctx);
  if (safe.sku && safe.sku !== prev.sku) {
    const existing = await repo.findBySku(ctx.companyId, safe.sku);
    if (existing) throw new ApiError(409, 'SKU ya existe', 'SKU_TAKEN');
  }
  const updated = await repo.update(id, safe);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'products', documentId: id, previousData: { sku: prev.sku, name: prev.name }, newData: safe, ip: ctx.ip });
  return updated;
}

async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
  const { hasReferences, productReferences } = require('../../utils/catalogDependencies');
  if (await hasReferences(ctx.companyId, id, productReferences)) throw new ApiError(409, 'El producto tiene existencias, movimientos o documentos relacionados. Desactívalo para conservar su historial.', 'PRODUCT_IN_USE');
  await repo.remove(id);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'DELETE', module: 'products', documentId: id, previousData: { sku: prev.sku, name: prev.name }, ip: ctx.ip });
  return { deleted: true };
}

module.exports = { create, list, getById, update, remove };
