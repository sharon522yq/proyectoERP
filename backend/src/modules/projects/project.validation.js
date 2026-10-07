const { body, param } = require('express-validator');

const projectOptional = [
  body('description').optional().isString().isLength({ max: 2000 }),
  body('budget').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
  body('startDate').optional().isISO8601(), body('endDate').optional().isISO8601()
];
const taskOptional = [
  body('description').optional().isString().isLength({ max: 2000 }),
  body('dueDate').optional().isISO8601(), body('assignedTo').optional().isMongoId(),
  body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH'])
];
const createProject = [...projectOptional, body('name').isString().trim().isLength({ min: 1, max: 200 })];
const createTask = [
  ...taskOptional,
  body('projectId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
];
const idParam = [param('id').isMongoId()];

const updateProject = [...projectOptional, param('id').isMongoId(), body('name').optional().isString().trim().isLength({ min: 1, max: 200 })];
const updateTask = [...taskOptional, param('id').isMongoId(), body('title').optional().isString().trim().isLength({ min: 1, max: 200 })];
module.exports = { createProject, createTask, updateProject, updateTask, idParam };
