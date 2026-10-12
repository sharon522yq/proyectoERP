const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const { asyncHandler } = require('../../utils/ApiError');
const { catalog, checkoutConfig } = require('./catalog');
const service = require('./service');
const router = Router();
router.use(rateLimit({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false }));
const handle = fn => asyncHandler(async (req, res) => res.json({ success: true, data: await fn(req) }));
const tokenRule = [body('token').isString().matches(/^[a-f0-9]{64}$/), validate];
const inviteCompletionRules = [
  body('token').isString().matches(/^[a-f0-9]{64}$/),
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('password').isString().isLength({ min: 8, max: 72 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72),
  validate
];
router.get('/catalog', handle(() => {
  let checkoutEnabled = false;
  try { checkoutConfig(); checkoutEnabled = true; } catch { /* Keep disabled until configured. */ }
  return { ...catalog(), checkoutEnabled };
}));
router.post('/verify', ...tokenRule, handle(req => service.verify(req.body.token)));
router.post('/invitations/complete', ...inviteCompletionRules, handle(req => service.completeInvite(req.body.token, req.body)));
router.use(authenticate);
router.post('/contracts', handle(req => service.newContract(req.user.id, req.body)));
router.get('/memberships', handle(req => service.memberships(req.user.id)));
router.post('/switch-company', body('companyId').isMongoId(), validate, handle(req => service.switchCompany(req.user.id, req.body.companyId)));
router.post('/verification', handle(req => service.sendVerification(req.user.id)));
router.get('/subscription', handle(req => service.subscriptionView(req.user.id)));
router.post('/checkout', handle(req => service.checkout(req.user.id)));
router.post('/setup', handle(req => service.setup(req.user.id, req.body)));
router.post('/invitations', body('email').isEmail().trim().toLowerCase(), body('role').optional().isString().trim().isLength({ min: 2, max: 40 }), validate,
  handle(req => service.invite(req.user.id, req.body.email, req.body.role, req.ip)));
router.post('/invitations/accept', ...tokenRule, handle(req => service.acceptInvite(req.user.id, req.body.token)));
router.post('/portal', handle(req => service.portal(req.user.id)));
router.post('/cancel', handle(req => service.cancel(req.user.id)));
module.exports = router;
