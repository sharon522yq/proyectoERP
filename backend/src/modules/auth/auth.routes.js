const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const controller = require('./auth.controller');
const v = require('./auth.validation');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de acceso, intenta más tarde', code: 'RATE_LIMIT' }
});

const router = Router();
router.post('/register', loginLimiter, v.registerRules, validate, controller.register);
router.post('/login', loginLimiter, v.loginRules, validate, controller.login);
router.post('/refresh', v.refreshRules, validate, controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.post('/change-password', authenticate, v.changeRules, validate, controller.changePassword);
router.post('/forgot-password', loginLimiter, v.forgotRules, validate, controller.forgotPassword);
router.post('/reset-password', loginLimiter, v.resetRules, validate, controller.resetPassword);

module.exports = router;
