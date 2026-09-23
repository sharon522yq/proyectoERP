const { body, param } = require('express-validator');

const createWarehouse = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('code').isString().trim().isLength({ min: 1, max: 20 }),
];
const adjustStock = [
  body('productId').isMongoId(),
  body('warehouseId').isMongoId(),
  body('quantity').isInt({ min: 1 }),
  body('type').isIn(['PURCHASE_ENTRY', 'SALE_EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'INITIAL_STOCK']),
];
const idParam = [param('id').isMongoId()];

module.exports = { createWarehouse, adjustStock, idParam };
