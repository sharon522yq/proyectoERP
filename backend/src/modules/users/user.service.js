const { assertCompany, isGlobal } = require('../../utils/companyAccess');
const bcrypt = require('bcryptjs');
const Company = require('../companies/company.model');
const User = require('./user.model');
const repo = require('./user.repository');
const roleService = require('../roles/role.service');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const ALLOWED_UPDATE_FIELDS = ['name', 'role', 'active'];

async function create(data, ctx) {
  if (!isGlobal(ctx)) {
    assertCompany(ctx, data.companyId || ctx.companyId);
    if (String(data.role).toUpperCase() === 'SUPER_ADMIN') throw new ApiError(403, 'Rol global restringido', 'FORBIDDEN');
  }
  const role = await roleService.findByName(String(data.role).toUpperCase());
  if (!role) throw new ApiError(400, 'Rol inválido', 'INVALID_ROLE');
  const existing = await repo.findByEmail(data.email.toLowerCase());
  if (existing) throw new ApiError(409, 'Email ya registrado', 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await repo.create({
    name: data.name, email: data.email.toLowerCase(), passwordHash,
    role: role.name, companyId: data.companyId || ctx.companyId || undefined
  });
  await logAudit({ userId: ctx.userId, companyId: user.companyId, action: 'CREATE', module: 'users', documentId: String(user._id), newData: { email: user.email, role: user.role }, ip: ctx.ip });
  return (await repo.findById(user._id)).toSafeJSON();
}

async function list(ctx) {
  if (!isGlobal(ctx) && !ctx.companyId) throw new ApiError(403, 'Empresa requerida', 'COMPANY_REQUIRED');
  const users = await repo.listByCompany(ctx.companyId);
  return users.map((u) => u.toSafeJSON());
}

async function getById(id, ctx) {
  const user = await repo.findById(id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  assertCompany(ctx, user.companyId);
  return user.toSafeJSON();
}

async function update(id, data, ctx) {
  const prev = await repo.findById(id);
  if (!prev) throw new ApiError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  assertCompany(ctx, prev.companyId);
  if (data.companyId !== undefined) {
    if (!isGlobal(ctx)) throw new ApiError(403, 'La asignación requiere permisos globales explícitos', 'COMPANY_ASSIGN_FORBIDDEN');
    if (prev.companyId && String(prev.companyId) !== String(data.companyId)) throw new ApiError(409, 'No se permite transferir usuarios entre empresas', 'COMPANY_TRANSFER_FORBIDDEN');
    const company = await Company.findById(data.companyId);
    if (!company || !company.active) throw new ApiError(400, 'Empresa inválida o inactiva', 'INVALID_COMPANY');
  }
  // Whitelist: solo campos permitidos
  const safe = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (data[key] !== undefined) safe[key] = data[key];
  }
  if (!isGlobal(ctx) && (prev.role === 'SUPER_ADMIN' || String(safe.role).toUpperCase() === 'SUPER_ADMIN')) throw new ApiError(403, 'Rol global restringido', 'FORBIDDEN');
  if (data.companyId !== undefined) { safe.companyId = data.companyId; safe.refreshTokenHash = null; }
  if (safe.role) {
    const role = await roleService.findByName(String(safe.role).toUpperCase());
    if (!role) throw new ApiError(400, 'Rol inválido', 'INVALID_ROLE');
    safe.role = role.name;
  }
  const change = data.companyId !== undefined || safe.role !== undefined || safe.active !== undefined;
  const updated = await User.findByIdAndUpdate(id, change ? { $set: safe, $inc: { sessionVersion: 1 } } : { $set: safe }, { new: true, runValidators: true });
  await logAudit({ userId: ctx.userId, companyId: prev.companyId, action: 'UPDATE', module: 'users', documentId: id, previousData: { name: prev.name, role: prev.role, companyId: prev.companyId }, newData: { name: safe.name, role: safe.role, active: safe.active, companyId: safe.companyId }, ip: ctx.ip });
  return updated.toSafeJSON();
}

async function remove(id, ctx) {
  const prev = await repo.findById(id);
  if (!prev) throw new ApiError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  if (String(prev._id) === String(ctx.userId)) throw new ApiError(400, 'No puedes desactivarte a ti mismo', 'SELF_DELETE');
  assertCompany(ctx, prev.companyId);
  await repo.update(id, { active: false });
  await logAudit({ userId: ctx.userId, companyId: prev.companyId, action: 'DELETE', module: 'users', documentId: id, previousData: { name: prev.name }, ip: ctx.ip });
  return { deactivated: true };
}

module.exports = { create, list, getById, update, remove };
