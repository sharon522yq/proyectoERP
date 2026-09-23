const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError, asyncHandler } = require('../utils/ApiError');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'No autenticado', 'AUTH_REQUIRED');
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    req.user = { id: payload.sub, role: payload.role, companyId: payload.companyId || null, permissions: payload.permissions || [] };
    return next();
  } catch {
    throw new ApiError(401, 'Sesión inválida o expirada', 'AUTH_INVALID');
  }
});

function hasPermission(userPermissions, required) {
  if (!userPermissions) return false;
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(required);
}

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'No autenticado', 'AUTH_REQUIRED'));
  if (!hasPermission(req.user.permissions, permission)) {
    return next(new ApiError(403, 'Sin permiso para esta operación', 'FORBIDDEN'));
  }
  return next();
};

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
