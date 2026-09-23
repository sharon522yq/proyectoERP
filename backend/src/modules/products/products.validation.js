const { body, param } = require('express-validator');

const createCategory = [body('name').isString().trim().isLength({ min: 1, max: 100 })];
const updateCategory = [param('id').isMongoId(), body('name').optional().isString().trim().isLength({ min: 1, max: 100 })];

const createProduct = [
  body('sku').isString().trim().isLength({ min: 1, max: 50 }),
  body('name').isString().trim().isLength({ min: 1, max: 200 }),
  body('price').isFloat({ min: 0 }),
  body('categoryId').optional().isMongoId(),
  body('unitId').optional().isMongoId(),
  body('cost').optional().isFloat({ min: 0 }),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }),
  body('minimumStock').optional().isInt({ min: 0 }),
];
const updateProduct = [
  param('id').isMongoId(),
  body('sku').optional().isString().trim().isLength({ min: 1, max: 50 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('price').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DISCONTINUED']),
];

const idParam = [param('id').isMongoId()];

module.exports = { createCategory, updateCategory, createProduct, updateProduct, idParam };
