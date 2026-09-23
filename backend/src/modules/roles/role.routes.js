const { Router } = require('express');
const { authenticate, requirePermission } = require('../../middlewares/auth');
const controller = require('./role.controller');

const router = Router();
router.use(authenticate);
router.get('/', requirePermission('roles.read'), controller.list);

module.exports = router;
