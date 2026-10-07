const { body, param } = require('express-validator');

const createDepartment = [body('name').isString().trim().isLength({ min: 1, max: 100 })];
const employeeOptional = [
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('phone').optional().isString().isLength({ max: 30 }),
  body('position').optional().isString().isLength({ max: 100 }),
  body('hireDate').optional().isISO8601(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'TERMINATED'])
];
const createEmployee = [
  ...employeeOptional,
  body('employeeId').isString().trim().isLength({ min: 1, max: 20 }),
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('departmentId').optional().isMongoId(),
  body('salary').optional().isFloat({ min: 0 }),
];
const idParam = [param('id').isMongoId()];

const updateEmployee = [
  ...employeeOptional, param('id').isMongoId(),
  body('employeeId').optional().isString().trim().isLength({ min: 1, max: 20 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 }),
  body('departmentId').optional().isMongoId(), body('userId').optional().isMongoId(),
  body('salary').optional().isFloat({ min: 0 })
];
module.exports = { createDepartment, createEmployee, updateEmployee, idParam };
