const { body, param, query } = require('express-validator');

const createWarehouse = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('code').isString().trim().isLength({ min: 1, max: 20 }),
  body('address').optional().isString().trim().isLength({ max: 300 }),
];
const updateWarehouse = [param('id').isMongoId(), body('name').optional().isString().trim().isLength({ min: 1, max: 150 }), body('code').optional().isString().trim().isLength({ min: 1, max: 20 }), body('address').optional().isString().trim().isLength({ max: 300 }), body('active').optional().isBoolean().toBoolean()];
const adjustStock = [
  body('productId').isMongoId(),
  body('warehouseId').isMongoId(),
  body('quantity').isInt({ min: 1 }),
  body('type').isIn(['PURCHASE_ENTRY', 'SALE_EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'INITIAL_STOCK']),
];
const idParam = [param('id').isMongoId()];

const exportQuery = [query('warehouseId').optional().isMongoId()];
module.exports = { exportQuery, updateWarehouse, createWarehouse, adjustStock, idParam };
