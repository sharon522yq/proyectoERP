const env = require('../../../config/env');
const { ApiError } = require('../../../utils/ApiError');
const MockProvider = require('./mock.provider');
const OpenAICompatProvider = require('./openai-compat.provider');

// Interfaz AIProvider (desacople del ERP de cualquier proveedor):
//   generateText(messages, opts)              → { text, tokensIn, tokensOut, latencyMs }
//   generateStructured(messages, schema, opts) → { data, raw, tokensIn, tokensOut, latencyMs }
//   analyze(prompt, opts)                      → generateStructured con schema de análisis
//   healthCheck()                              → { ok, provider, model, detail }
// Añadir un proveedor nativo = crear fichero adapter + registrarlo aquí.
function createProvider() {
  const cfg = env.ai;
  switch (cfg.provider) {
    case 'mock':
      return new MockProvider(cfg);
    case 'openai-compatible': {
      const isLocal = cfg.baseUrl && /localhost|127\.0\.0\.1/.test(cfg.baseUrl);
      if (!cfg.baseUrl) throw new ApiError(503, 'Proveedor IA no configurado (falta AI_BASE_URL)', 'AI_NOT_CONFIGURED');
      if (!cfg.apiKey && !isLocal) throw new ApiError(503, 'Proveedor IA no configurado (falta AI_API_KEY)', 'AI_NOT_CONFIGURED');
      if (!cfg.model) throw new ApiError(503, 'Proveedor IA no configurado (falta AI_MODEL)', 'AI_NOT_CONFIGURED');
      return new OpenAICompatProvider(cfg);
    }
    default:
      throw new ApiError(503, `Proveedor IA desconocido: ${cfg.provider}`, 'AI_NOT_CONFIGURED');
  }
}

module.exports = { createProvider };
