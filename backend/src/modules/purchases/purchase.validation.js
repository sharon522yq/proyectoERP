const { body, param } = require('express-validator');

const createOrder = [
  body('warehouseId').optional().isMongoId(),
  body('items.*.taxRate').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('supplierId').isMongoId(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }).toInt(),
  body('items.*.unitCost').isFloat({ min: 0 }).toFloat(),
];
const idParam = [body('warehouseId').optional().isMongoId(), param('id').isMongoId()];

module.exports = { createOrder, idParam };
