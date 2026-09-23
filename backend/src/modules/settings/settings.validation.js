const { body, param } = require('express-validator');

const putRules = [
  body('key').isString().trim().isLength({ min: 1, max: 100 }),
  body('value').exists()
];

module.exports = { putRules };
