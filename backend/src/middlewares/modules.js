const Setting = require('../modules/settings/settings.model');
const { ApiError, asyncHandler } = require('../utils/ApiError');
const OPTIONAL_MODULES = ['hr', 'projects', 'production', 'ai'];
async function enabledModules(companyId) {
  const setting = await Setting.findOne({ companyId, key: 'modulePreferences' }).lean();
  return Array.isArray(setting?.value?.enabledModules) ? setting.value.enabledModules.filter(name => OPTIONAL_MODULES.includes(name)) : OPTIONAL_MODULES;
}
const requireEnabledModule = name => asyncHandler(async (req, res, next) => {
  if (!(await enabledModules(req.companyId)).includes(name)) throw new ApiError(403, 'Este módulo está desactivado para tu empresa. Su administrador puede habilitarlo en Configuración.', 'MODULE_DISABLED');
  next();
});
module.exports = { OPTIONAL_MODULES, enabledModules, requireEnabledModule };
