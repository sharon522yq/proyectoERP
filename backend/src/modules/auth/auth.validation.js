const { body } = require('express-validator');

const registerRules = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 72 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72),
  body('role').optional().isString().trim(),
  body('companyId').optional().isMongoId()
];
const loginRules = [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1, max: 100 })];
const refreshRules = [body('refreshToken').isString().isLength({ min: 10 })];
const changeRules = [
  body('currentPassword').isString().isLength({ min: 1 }),
  body('newPassword').isString().isLength({ min: 8, max: 72 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72)
];
const forgotRules = [body('email').isEmail().normalizeEmail()];
const resetRules = [body('token').isString().isLength({ min: 10 }), body('newPassword').isString().isLength({ min: 8, max: 72 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72)];

module.exports = { registerRules, loginRules, refreshRules, changeRules, forgotRules, resetRules };
