const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./products.validation');
const ctrl = require('./products.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// Categories
router.get('/categories', requirePermission('categories.read'), ctrl.listCategories);
router.post('/categories', requirePermission('categories.create'), v.createCategory, validate, ctrl.createCategory);
router.get('/categories/:id', requirePermission('categories.read'), v.idParam, validate, ctrl.getCategory);
router.put('/categories/:id', requirePermission('categories.update'), v.updateCategory, validate, ctrl.updateCategory);
router.delete('/categories/:id', requirePermission('categories.delete'), v.idParam, validate, ctrl.deleteCategory);

// Products
router.get('/', requirePermission('products.read'), ctrl.listProducts);
router.post('/', requirePermission('products.create'), v.createProduct, validate, ctrl.createProduct);
router.get('/:id', requirePermission('products.read'), v.idParam, validate, ctrl.getProduct);
router.put('/:id', requirePermission('products.update'), v.updateProduct, validate, ctrl.updateProduct);
router.delete('/:id', requirePermission('products.delete'), v.idParam, validate, ctrl.deleteProduct);

module.exports = router;
