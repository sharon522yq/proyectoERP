const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./finance.validation');
const ctrl = require('./finance.controller');

const router = Router();
router.use(authenticate, scopeCompany);

router.get('/summary', requirePermission('finance.accounts.read'), ctrl.getSummary);
router.post('/accounts', requirePermission('finance.accounts.create'), v.createAccount, validate, ctrl.createAccount);
router.get('/accounts', requirePermission('finance.accounts.read'), ctrl.listAccounts);
router.get('/accounts/:id', requirePermission('finance.accounts.read'), v.idParam, validate, ctrl.getAccount);
router.post('/transactions', requirePermission('finance.transactions.create'), v.createTransaction, validate, ctrl.createTransaction);
router.get('/transactions', requirePermission('finance.transactions.read'), ctrl.listTransactions);

module.exports = router;
