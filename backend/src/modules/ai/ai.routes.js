const { requireEnabledModule } = require('../../middlewares/modules');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const env = require('../../config/env');
const v = require('./ai.validation');
const ctrl = require('./ai.controller');

const router = Router();
router.use(authenticate, scopeCompany, requireEnabledModule('ai'));

// Rate limit específico de IA (por IP). Complementa los techos diarios por
// usuario/empresa (ai.limits) y el límite global (300/15min).
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.ai.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Límite de peticiones de IA alcanzado, intenta más tarde', code: 'AI_RATE_LIMIT' }
});

// RBAC mínimo de la FASE 12: ai.chat / ai.analyze / ai.read (catálogo v4)
router.post('/chat', aiLimiter, requirePermission('ai.chat'), v.chat, validate, ctrl.chat);
router.post('/analyze', aiLimiter, requirePermission('ai.analyze'), v.analyze, validate, ctrl.analyze);
router.get('/health', requirePermission('ai.read'), ctrl.health);

module.exports = router;
