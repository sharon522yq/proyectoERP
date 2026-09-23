const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./hr.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

const createDepartment = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createDepartment(req.body, ctx(req)) }); });
const listDepartments = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listDepartments(ctx(req)) }); });
const createEmployee = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createEmployee(req.body, ctx(req)) }); });
const listEmployees = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listEmployees(ctx(req), req.query) }); });
const getEmployee = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getEmployee(req.params.id, ctx(req)) }); });
const updateEmployee = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateEmployee(req.params.id, req.body, ctx(req)) }); });

module.exports = { createDepartment, listDepartments, createEmployee, listEmployees, getEmployee, updateEmployee };
