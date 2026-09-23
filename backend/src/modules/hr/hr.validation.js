const { body, param } = require('express-validator');

const createDepartment = [body('name').isString().trim().isLength({ min: 1, max: 100 })];
const createEmployee = [
  body('employeeId').isString().trim().isLength({ min: 1, max: 20 }),
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('departmentId').optional().isMongoId(),
  body('salary').optional().isFloat({ min: 0 }),
];
const idParam = [param('id').isMongoId()];

module.exports = { createDepartment, createEmployee, idParam };
