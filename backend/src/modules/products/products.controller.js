const { asyncHandler } = require('../../utils/ApiError');
const catService = require('./category.service');
const prodService = require('./product.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

// Categories
const createCategory = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await catService.create(req.body, ctx(req)) }); });
const listCategories = asyncHandler(async (req, res) => { res.json({ success: true, data: await catService.list(ctx(req), req.query) }); });
const getCategory = asyncHandler(async (req, res) => { res.json({ success: true, data: await catService.getById(req.params.id, ctx(req)) }); });
const updateCategory = asyncHandler(async (req, res) => { res.json({ success: true, data: await catService.update(req.params.id, req.body, ctx(req)) }); });
const deleteCategory = asyncHandler(async (req, res) => { res.json({ success: true, data: await catService.remove(req.params.id, ctx(req)) }); });

// Products
const createProduct = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await prodService.create(req.body, ctx(req)) }); });
const listProducts = asyncHandler(async (req, res) => { res.json({ success: true, data: await prodService.list(ctx(req), req.query) }); });
const getProduct = asyncHandler(async (req, res) => { res.json({ success: true, data: await prodService.getById(req.params.id, ctx(req)) }); });
const updateProduct = asyncHandler(async (req, res) => { res.json({ success: true, data: await prodService.update(req.params.id, req.body, ctx(req)) }); });
const deleteProduct = asyncHandler(async (req, res) => { res.json({ success: true, data: await prodService.remove(req.params.id, ctx(req)) }); });

module.exports = { createCategory, listCategories, getCategory, updateCategory, deleteCategory, createProduct, listProducts, getProduct, updateProduct, deleteProduct };
