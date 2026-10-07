const { body, param } = require('express-validator');

const createAccount = [
  body('code').isString().trim().isLength({ min: 1, max: 20 }),
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('type').isIn(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
];
const createTransaction = [
  body('requestId').optional().isString().isLength({ min: 8, max: 80 }),
  body('accountId').isMongoId(),
  body('type').isIn(['INCOME', 'EXPENSE', 'TRANSFER']),
  body('amount').isFloat({ min: 0.01 }).toFloat().custom(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8),
  body('description').optional().isString().trim().isLength({ max: 500 }),
];
const idParam = [param('id').isMongoId()];

module.exports = { createAccount, createTransaction, idParam };
