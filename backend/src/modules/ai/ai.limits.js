const env = require('../../config/env');
const { ApiError } = require('../../utils/ApiError');

// Control de coste por usuario/empresa (en memoria, ventana diaria UTC).
// Nota: contadores por proceso; al escalar a múlturas instancias migrar a Redis
// (mismo hueco que el rate-limit global). Documentado en docs/AI_SECURITY.md.
const counters = new Map();

function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function peek(scope, id) {
  return counters.get(`${scope}:${id}:${dayKey()}`) || 0;
}

function incr(scope, id) {
  const key = `${scope}:${id}:${dayKey()}`;
  counters.set(key, (counters.get(key) || 0) + 1);
}

function cleanup() {
  const suffix = `:${dayKey()}`;
  for (const key of counters.keys()) if (!key.endsWith(suffix)) counters.delete(key);
}

// Verifica ambos techos ANTES de incrementar cualquiera (o se incrementan los dos)
function assertWithinLimits({ userId, companyId }) {
  cleanup();
  if (peek('user', userId) >= env.ai.dailyUserMax) {
    throw new ApiError(429, 'Límite diario de uso de IA alcanzado (usuario)', 'AI_DAILY_LIMIT');
  }
  if (peek('company', companyId) >= env.ai.dailyCompanyMax) {
    throw new ApiError(429, 'Límite diario de uso de IA alcanzado (empresa)', 'AI_DAILY_LIMIT');
  }
  incr('user', userId);
  incr('company', companyId);
}

function resetLimits() {
  counters.clear();
}

module.exports = { assertWithinLimits, resetLimits };
