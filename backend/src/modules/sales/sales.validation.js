const { body, param } = require('express-validator');

const quoteItem = {
  productId: body('items.*.productId').isMongoId(),
  quantity: body('items.*.quantity').isInt({ min: 1 }),
  unitPrice: body('items.*.unitPrice').isFloat({ min: 0 }),
};

const createQuote = [
  body('customerId').isMongoId(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.unitPrice').isFloat({ min: 0 }),
];
const createPayment = [
  body('amount').isFloat({ min: 0.01 }),
  body('method').isIn(['CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER']),
];
const idParam = [param('id').isMongoId()];

module.exports = { createQuote, createPayment, idParam };
