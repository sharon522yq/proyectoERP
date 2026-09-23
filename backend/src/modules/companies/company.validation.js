const { body, param } = require('express-validator');

const createRules = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('taxId').optional().isString().trim().isLength({ max: 40 }),
  body('email').optional().isEmail().normalizeEmail()
];
const idRule = [param('id').isMongoId()];
const updateRules = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('active').optional().isBoolean()
];

module.exports = { createRules, idRule, updateRules };
