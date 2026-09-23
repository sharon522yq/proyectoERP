const { body, param } = require('express-validator');

const createRules = [
  body('companyId').isMongoId(),
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('address').optional().isString().trim().isLength({ max: 250 })
];
const updateRules = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('address').optional().isString().trim().isLength({ max: 250 }),
  body('active').optional().isBoolean()
];

module.exports = { createRules, updateRules, idRule: [param('id').isMongoId()] };
