const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../docs/swagger.json');
const { version: appVersion } = require('../package.json');
const env = require('./config/env');
const { errorHandler, notFound } = require('./middlewares/http');

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const roleRoutes = require('./modules/roles/role.routes');
const companyRoutes = require('./modules/companies/company.routes');
const branchRoutes = require('./modules/branches/branch.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const crmRoutes = require('./modules/crm/crm.routes');
const productsRoutes = require('./modules/products/products.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const salesRoutes = require('./modules/sales/sales.routes');
const purchasesRoutes = require('./modules/purchases/purchase.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const hrRoutes = require('./modules/hr/hr.routes');
const projectsRoutes = require('./modules/projects/project.routes');
const productionRoutes = require('./modules/production/production.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const aiRoutes = require('./modules/ai/ai.routes');

function createApp() {
  const app = express();

  // OWASP: no exponer el framework (X-Powered-By)
  app.disable('x-powered-by');
  app.use(helmet());

  // OWASP A03 (NoSQL injection): los query params deben ser escalares.
  // Se eliminan objetos (?limit[$gt]=1) y se limitan page/limit a enteros,
  // evitando constructores de filtro y NaN en paginación.
  app.use((req, res, next) => {
    if (req.query && typeof req.query === 'object') {
      for (const [key, value] of Object.entries(req.query)) {
        if (value && typeof value === 'object') delete req.query[key];
        else if ((key === 'page' || key === 'limit') && !/^\d+$/.test(String(value))) delete req.query[key];
      }
    }
    next();
  });

  const allowedOrigins = [env.frontendUrl];
  if (env.env !== 'production') {
    allowedOrigins.push('http://localhost:19006', 'http://localhost:8081');
  }
  app.use(cors({ origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(null, false);
  }}));

  app.use(express.json({ limit: '1mb' }));
  if (env.env !== 'test') app.use(morgan('dev'));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas peticiones, intenta más tarde', code: 'RATE_LIMIT' }
  });
  app.use(limiter);

  app.get('/health', (req, res) => res.json({ success: true, service: 'erp-backend', version: appVersion }));

  // Swagger docs
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { customSiteTitle: 'ERP API Docs' }));

  // Core
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/roles', roleRoutes);
  app.use('/api/v1/companies', companyRoutes);
  app.use('/api/v1/branches', branchRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/settings', settingsRoutes);

  // FASE 2/3
  app.use('/api/v1/crm', crmRoutes);
  app.use('/api/v1/products', productsRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/sales', salesRoutes);
  app.use('/api/v1/purchases', purchasesRoutes);
  app.use('/api/v1/finance', financeRoutes);
  app.use('/api/v1/hr', hrRoutes);
  app.use('/api/v1/projects', projectsRoutes);
  app.use('/api/v1/production', productionRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);

  // Backward compat: rutas viejas sin versioning
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/branches', branchRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/crm', crmRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/purchases', purchasesRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/hr', hrRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/production', productionRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // FASE 12 — IA (desacoplada por adapter; 501 AI_DISABLED si AI_ENABLED=false)
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/ai', aiRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
