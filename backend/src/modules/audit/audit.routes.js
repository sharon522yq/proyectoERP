const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const controller = require('./audit.controller');

const router = Router();
router.use(authenticate, scopeCompany);
router.get('/', requirePermission('audit.read'), controller.list);

module.exports = router;
