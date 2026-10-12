const { body, param, query } = require('express-validator');
const listProducts = [query('page').optional().isInt({ min: 1, max: 100000 }).bail().toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).bail().toInt(),
  query('search').optional().isString().trim().isLength({ max: 200 }),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DISCONTINUED']), query('categoryId').optional().isMongoId()];

const createCategory = [body('name').isString().trim().isLength({ min: 1, max: 100 }), body('parentId').optional().isMongoId()];
const updateCategory = [param('id').isMongoId(), body('name').optional().isString().trim().isLength({ min: 1, max: 100 }), body('parentId').optional().isMongoId()];

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
  body('cost').optional().isFloat({ min: 0 }), body('taxRate').optional().isFloat({ min: 0, max: 100 }),
  body('minimumStock').optional().isInt({ min: 0 }), body('maximumStock').optional().isInt({ min: 0 }),
  body('categoryId').optional().isMongoId(), body('unitId').optional().isMongoId(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DISCONTINUED']),
];

const idParam = [param('id').isMongoId()];

module.exports = { createCategory, updateCategory, createProduct, updateProduct, idParam, listProducts };
