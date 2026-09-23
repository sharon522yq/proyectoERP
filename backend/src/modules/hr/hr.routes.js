const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./hr.validation');
const ctrl = require('./hr.controller');

const router = Router();
router.use(authenticate, scopeCompany);

router.post('/departments', requirePermission('hr.departments.create'), v.createDepartment, validate, ctrl.createDepartment);
router.get('/departments', requirePermission('hr.departments.read'), ctrl.listDepartments);
router.post('/employees', requirePermission('hr.employees.create'), v.createEmployee, validate, ctrl.createEmployee);
router.get('/employees', requirePermission('hr.employees.read'), ctrl.listEmployees);
router.get('/employees/:id', requirePermission('hr.employees.read'), v.idParam, validate, ctrl.getEmployee);
router.put('/employees/:id', requirePermission('hr.employees.update'), v.idParam, validate, ctrl.updateEmployee);

module.exports = router;
