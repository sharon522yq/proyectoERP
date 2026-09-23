const { body, param } = require('express-validator');

const createRules = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 100 }),
  body('role').isString().trim().isLength({ min: 2, max: 40 }),
  body('companyId').optional().isMongoId()
];
const updateRules = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('role').optional().isString().trim().isLength({ min: 2, max: 40 }),
  body('active').optional().isBoolean(),
  body('companyId').optional().isMongoId()
];

module.exports = { createRules, updateRules, idRule: [param('id').isMongoId()] };
