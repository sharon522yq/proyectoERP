const { body, param } = require('express-validator');

const putRules = [
  body('key').isString().trim().isLength({ min: 1, max: 100 }),
  body('value').exists().custom((value, { req }) => {
    if (req.body.key !== 'modulePreferences') return true;
    const allowed = require('../../middlewares/modules').OPTIONAL_MODULES;
    if (!Array.isArray(value?.enabledModules) || value.enabledModules.some(name => !allowed.includes(name)) || new Set(value.enabledModules).size !== value.enabledModules.length)
      throw new Error('Selecciona únicamente módulos opcionales disponibles, sin duplicados');
    return true;
  })
];

module.exports = { putRules };
