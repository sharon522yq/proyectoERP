const { requireEnabledModule } = require('../../middlewares/modules');
const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./project.validation');
const ctrl = require('./project.controller');

const router = Router();
router.use(authenticate, scopeCompany, requireEnabledModule('projects'));

// Tasks (antes de /:id para evitar conflicto de routing)
router.post('/tasks', requirePermission('projects.tasks.create'), v.createTask, validate, ctrl.createTask);
router.get('/tasks', requirePermission('projects.tasks.read'), ctrl.listTasks);
router.put('/tasks/:id', requirePermission('projects.tasks.update'), v.updateTask, validate, ctrl.updateTask);

// Projects
router.post('/', requirePermission('projects.create'), v.createProject, validate, ctrl.createProject);
router.get('/', requirePermission('projects.read'), ctrl.listProjects);
router.get('/:id', requirePermission('projects.read'), v.idParam, validate, ctrl.getProject);
router.put('/:id', requirePermission('projects.update'), v.updateProject, validate, ctrl.updateProject);

module.exports = router;
