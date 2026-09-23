const { body, param } = require('express-validator');

const createProject = [body('name').isString().trim().isLength({ min: 1, max: 200 })];
const createTask = [
  body('projectId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
];
const idParam = [param('id').isMongoId()];

module.exports = { createProject, createTask, idParam };
