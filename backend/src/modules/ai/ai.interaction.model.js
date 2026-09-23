const mongoose = require('mongoose');
const env = require('../../config/env');

// FASE 12 — Registro auditable de interacciones con IA.
// Política de datos:
//  - SOLO metadatos: nunca API keys, credenciales ni secretos.
//  - El texto íntegro de prompt/respuesta NO se guarda por defecto (AI_STORE_TEXT=false).
//  - Retención por TTL configurable (AI_RETENTION_DAYS, default 90 días).
const aiInteractionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, maxlength: 64, index: true },
  provider: { type: String, required: true },
  model: { type: String },
  requestType: { type: String, enum: ['chat', 'analyze'], required: true },
  promptMetadata: {
    questionLength: { type: Number, default: 0 },
    scope: { type: String, maxlength: 200 },
    toolsAvailable: [{ type: String }],
    toolsUsed: [{ type: String }]
  },
  responseMetadata: {
    answerLength: { type: Number, default: 0 },
    refused: { type: Boolean, default: false }
  },
  tokensInput: { type: Number, default: 0 },
  tokensOutput: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  status: { type: String, enum: ['OK', 'ERROR', 'INVALID_RESPONSE', 'RATE_LIMITED', 'TIMEOUT'], required: true },
  errorCode: { type: String },
  // Solo si AI_STORE_TEXT=true; nunca debe contener secretos
  promptText: { type: String, select: false },
  responseText: { type: String, select: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'ai_interactions' });

aiInteractionSchema.index({ companyId: 1, createdAt: -1 });
aiInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.ai.retentionDays * 86400 });

module.exports = mongoose.models.AiInteraction || mongoose.model('AiInteraction', aiInteractionSchema);
