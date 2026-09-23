const { body, param } = require('express-validator');

const createOrder = [
  body('supplierId').isMongoId(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.unitCost').isFloat({ min: 0 }),
];
const idParam = [param('id').isMongoId()];

module.exports = { createOrder, idParam };
