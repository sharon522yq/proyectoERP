require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || '',
  gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me-32-chars-minimum',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-change-me-32-chars-min',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10)
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:19006',
  corsOrigins: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:19006').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean),
  // FASE 12 — IA: proveedor desacoplado; secretos SOLO por variables de entorno.
  // Kill-switch: con proveedor real debe habilitarse explícitamente (AI_ENABLED=true);
  // con el proveedor determinista "mock" (default) habilita desarrollo/tests sin claves.
  ai: (() => {
    const provider = process.env.AI_PROVIDER || 'mock';
    return {
      enabled: process.env.AI_ENABLED !== undefined ? process.env.AI_ENABLED === 'true' : provider === 'mock',
      provider,
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || '',
      baseUrl: process.env.AI_BASE_URL || '',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024', 10),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.2'),
      timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '20000', 10),
      rateLimitMax: parseInt(process.env.AI_RATE_LIMIT_MAX || '20', 10),
      dailyUserMax: parseInt(process.env.AI_DAILY_USER_MAX || '100', 10),
      dailyCompanyMax: parseInt(process.env.AI_DAILY_COMPANY_MAX || '500', 10),
      retentionDays: parseInt(process.env.AI_RETENTION_DAYS || '90', 10),
      storeText: process.env.AI_STORE_TEXT === 'true'
    };
  })()
};

// Fail-fast en producción: prohíbe secretos JWT de desarrollo o cortos (OWASP: gestión de secretos)
if (module.exports.env === 'production') {
  const devSecrets = ['dev-secret-change-me-32-chars-minimum', 'dev-refresh-change-me-32-chars-min'];
  const jwtSecret = process.env.JWT_SECRET || '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  if (!jwtSecret || devSecrets.includes(jwtSecret) || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET no configurado o inseguro en producción (requiere >= 32 caracteres, distinto del valor de desarrollo)');
  }
  if (!refreshSecret || devSecrets.includes(refreshSecret) || refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET no configurado o inseguro en producción (requiere >= 32 caracteres, distinto del valor de desarrollo)');
  }
  if (jwtSecret === refreshSecret) {
    throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos en producción');
  }
}
