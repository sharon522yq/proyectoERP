const { ApiError } = require('../../utils/ApiError');

// No commercial price is inferred. An absent configuration disables checkout.
function catalog() {
  const amount = Number(process.env.COMMERCIAL_AMOUNT_MINOR);
  const currency = process.env.COMMERCIAL_CURRENCY || 'mxn';
  const interval = process.env.COMMERCIAL_INTERVAL || 'month';
  const maxUsers = Number(process.env.COMMERCIAL_MAX_USERS || 5);
  const configured = Number.isSafeInteger(amount) && amount > 0 &&
    ['mxn', 'usd', 'eur'].includes(currency) && ['month', 'year'].includes(interval) &&
    Number.isSafeInteger(maxUsers) && maxUsers > 0;
  return {
    id: 'initial', name: process.env.COMMERCIAL_PLAN_NAME || 'Plan inicial',
    amount: configured ? amount : null, currency, interval, maxUsers,
    modules: ['crm', 'products', 'inventory', 'sales', 'purchases', 'finance', 'hr', 'projects', 'production', 'dashboard'],
    resourceLimits: { products: null, inventoryMovements: null, projects: null }, // null explicitly means unlimited.
    cancellation: 'period_end', graceDays: 0,
    retention: 'Sin borrado automático; política definitiva pendiente de revisión',
    termsVersion: process.env.COMMERCIAL_TERMS_VERSION || 'draft-2026-10-05',
    legalReviewed: process.env.COMMERCIAL_LEGAL_APPROVED === 'true',
    testData: process.env.COMMERCIAL_MODE !== 'live', configured
  };
}

function checkoutConfig() {
  const plan = catalog();
  const mode = process.env.COMMERCIAL_MODE || 'disabled';
  const key = process.env.STRIPE_SECRET_KEY || '';
  const production = process.env.NODE_ENV === 'production';
  if (!plan.configured || !['test', 'live'].includes(mode) ||
      !process.env.STRIPE_PRICE_ID || !process.env.STRIPE_WEBHOOK_SECRET ||
      !key.startsWith(mode === 'live' ? 'sk_live_' : 'sk_test_') ||
      (mode === 'live' && (!production || !plan.legalReviewed ||
        process.env.COMMERCIAL_LIVE_APPROVED !== 'true')) ||
      (production && mode !== 'live')) {
    throw new ApiError(503, 'Contratación no habilitada: falta configuración validada', 'COMMERCIAL_DISABLED');
  }
  const url = process.env.FRONTEND_URL || '';
  try {
    if (new URL(url).origin !== url) throw new Error('Invalid origin');
  } catch { throw new ApiError(503, 'Configura FRONTEND_URL como origen sin ruta ni barra final', 'COMMERCIAL_DISABLED'); }
  if (!/^https:\/\//.test(url) && !(mode === 'test' && /^http:\/\/localhost(?::\d+)?$/.test(url))) {
    throw new ApiError(503, 'URL pública inválida', 'COMMERCIAL_DISABLED');
  }
  return { plan, mode, key, url };
}

module.exports = { catalog, checkoutConfig };
