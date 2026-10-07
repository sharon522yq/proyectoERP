const { body, param } = require('express-validator');

const createBom = [
  body('productId').isMongoId(),
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('items').isArray({ min: 1 }),
  body('items.*.componentProductId').isMongoId(),
  body('items.*.quantity').isFloat({ min: 0.001 }).toFloat(),
];
const createProductionOrder = [
  body('productId').isMongoId(),
  body('bomId').isMongoId(),
  body('warehouseId').isMongoId(),
  body('quantity').isInt({ min: 1 }).toInt(),
];
const createWorkOrder = [
  body('productionOrderId').isMongoId(),
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('sequence').isInt({ min: 1 }).toInt(),
];
const idParam = [param('id').isMongoId()];

module.exports = { createBom, createProductionOrder, createWorkOrder, idParam };
