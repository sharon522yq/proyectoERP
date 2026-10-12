const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError, asyncHandler } = require('../utils/ApiError');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'No autenticado', 'AUTH_REQUIRED');
  let payload;
  try { payload = jwt.verify(token, env.jwt.secret); }
  catch { throw new ApiError(401, 'Sesión inválida o expirada', 'AUTH_INVALID'); }
  const User = require('../modules/users/user.model');
  const roleService = require('../modules/roles/role.service');
  const user = await User.findById(payload.sub).select('+sessionVersion');
  if (!user || !user.active || (payload.version || 0) !== (user.sessionVersion || 0)) {
    throw new ApiError(401, 'Sesión inválida o expirada', 'AUTH_INVALID');
  }
  if (String(payload.companyId || '') !== String(user.companyId || '')) {
    throw new ApiError(401, 'La empresa de esta sesión cambió. Inicia sesión nuevamente.', 'SESSION_CONTEXT_CHANGED');
  }
  const role = await roleService.findByName(user.role);
  req.user = { id: String(user._id), role: user.role, companyId: user.companyId ? String(user.companyId) : null, permissions: role ? role.permissions.filter(p => (payload.permissions || []).includes('*') || (payload.permissions || []).includes(p)) : [] };
  const membership = user.companyId ? await require('../modules/commercial/models').Membership.findOne({ userId: user._id, companyId: user.companyId }) : null;
  req.user.commercialAccount = membership ? membership.commercial : user.commercialAccount;
  req.user.emailVerifiedAt = user.emailVerifiedAt;
  if (req.user.commercialAccount && !/^\/api\/v1\/(auth|commercial)(\/|$)/.test(req.originalUrl)) {
    if (!req.user.companyId || !req.user.emailVerifiedAt) throw new ApiError(403, 'Cuenta pendiente de activación', 'ACTIVATION_REQUIRED');
    const grant = await require('../modules/initialization/accessGrant.model').findOne({ companyId: req.user.companyId, active: true, expiresAt: { $gt: new Date() } });
    const granted = grant && (grant.mode === 'development_fixture' && ['development', 'test'].includes(env.env) || grant.mode === 'internal' && process.env.INTERNAL_ACCESS_ENABLED === 'true');
    if (granted) req.user.moduleEntitlements = grant.modules;
    else {
      const contract = await require('../modules/commercial/models').Contract.findOne({ companyId: req.user.companyId, status: 'active', periodEnd: { $gt: new Date() } });
      if (!contract) throw new ApiError(403, 'Gestiona tu suscripción para recuperar el acceso', 'SUBSCRIPTION_REQUIRED');
      req.user.moduleEntitlements = contract.plan.modules;
    }
  }
  return next();
});

function hasPermission(userPermissions, required) {
  if (!userPermissions) return false;
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(required);
}

const requirePermission = (permission) => asyncHandler(async (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'No autenticado', 'AUTH_REQUIRED'));
  if (!req.user.commercialAccount && !req.user.companyId && !req.user.permissions.includes('*')) return next(new ApiError(403, 'Tu cuenta no tiene una empresa asignada', 'COMPANY_REQUIRED'));
  if (req.user.commercialAccount) {
    if (!req.user.emailVerifiedAt || !req.user.companyId) throw new ApiError(403, 'Cuenta pendiente de activación', 'ACTIVATION_REQUIRED');
    const grant = await require('../modules/initialization/accessGrant.model').findOne({ companyId: req.user.companyId, active: true, expiresAt: { $gt: new Date() } });
    const grantAllowed = grant && ((grant.mode === 'development_fixture' && ['development', 'test'].includes(env.env)) ||
      (grant.mode === 'internal' && process.env.INTERNAL_ACCESS_ENABLED === 'true'));
    const module = permission.split('.')[0];
    const moduleName = ['categories', 'units'].includes(module) ? 'products' : module;
    if (grantAllowed) {
      if (module === 'users' && !permission.endsWith('.read')) throw new ApiError(403, 'El primer acceso no permite provisionar otros usuarios internos', 'INTERNAL_MANAGED');
      if (!['users', 'roles', 'companies', 'branches', 'audit', 'settings'].includes(moduleName) && !grant.modules.includes(moduleName)) {
        throw new ApiError(403, 'Módulo no autorizado para este acceso interno', 'INTERNAL_MODULE');
      }
      if (permission === 'companies.create') throw new ApiError(403, 'La inicialización no permite administrar la plataforma', 'FORBIDDEN');
      if (!hasPermission(req.user.permissions, permission)) throw new ApiError(403, 'Sin permiso para esta operación', 'FORBIDDEN');
      return next();
    }
    const { Contract } = require('../modules/commercial/models');
    const contract = await Contract.findOne({ companyId: req.user.companyId });
    if (!contract || contract.status !== 'active' || !contract.periodEnd || contract.periodEnd <= new Date()) {
      throw new ApiError(403, 'Gestiona tu suscripción para recuperar el acceso', 'SUBSCRIPTION_REQUIRED');
    }
    if (!['users', 'roles', 'companies', 'branches', 'audit', 'settings'].includes(moduleName) && !contract.plan.modules.includes(moduleName)) {
      throw new ApiError(403, 'Módulo no incluido en el plan', 'PLAN_MODULE');
    }
    // Membership writes go through transactional invitations; no legacy bypass.
    if ((module === 'users' && !permission.endsWith('.read')) || permission === 'companies.create' ||
        (module === 'branches' && !permission.endsWith('.read'))) {
      throw new ApiError(403, 'Usa la configuración o invitaciones de la suscripción', 'COMMERCIAL_MANAGED');
    }
  }
  if (!hasPermission(req.user.permissions, permission)) {
    return next(new ApiError(403, 'Sin permiso para esta operación', 'FORBIDDEN'));
  }
  return next();
});

// Inyecta companyId del JWT para scoping multiempresa
// Si el JWT no tiene companyId, lo busca en la DB como fallback
const scopeCompany = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.companyId) {
    req.companyId = req.user.companyId;
    return next();
  }
  // Fallback: buscar companyId en la DB si no está en el token
  if (req.user && req.user.id) {
    const User = require('../modules/users/user.model');
    const user = await User.findById(req.user.id).select('companyId').lean();
    if (user && user.companyId) {
      req.companyId = String(user.companyId);
      return next();
    }
  }
  req.companyId = null;
  return next();
});

module.exports = { authenticate, requirePermission, hasPermission, scopeCompany };
