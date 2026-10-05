const { ApiError } = require('./ApiError');
function isGlobal(ctx) { return (ctx.permissions || []).includes('*'); }
function assertCompany(ctx, companyId) {
  if (isGlobal(ctx)) return;
  if (!ctx.companyId || !companyId || String(ctx.companyId) !== String(companyId)) {
    throw new ApiError(403, 'Acceso denegado a otra empresa', 'CROSS_COMPANY');
  }
}
function pick(data, fields) {
  return Object.fromEntries(fields.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
}
module.exports = { isGlobal, assertCompany, pick };
