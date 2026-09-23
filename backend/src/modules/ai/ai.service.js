// AI Service (ETAPA 2): orquestación de la tubería IA.
// Usuario → API (JWT+RBAC+scopeCompany) → límites → Context Builder → Provider Adapter
//   → (selección de tool → intersección de permisos → tool ERP → síntesis) → validación
//   → respuesta + registro en ai_interactions.
// El servicio NUNCA accede a MongoDB directamente: solo vía tools autorizadas.

const crypto = require('crypto');
const env = require('../../config/env');
const { ApiError } = require('../../utils/ApiError');
const { createProvider } = require('./providers');
const tools = require('./ai.tools');
const context = require('./ai.context');
const limits = require('./ai.limits');
const { validateChatSelection, validateAnalysis } = require('./ai.schemas');
const Interaction = require('./ai.interaction.model');

const estTokens = (s) => Math.ceil(String(s || '').length / 4);

// Timeout duro por invocación (proveedor o tool)
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ApiError(504, 'El proveedor de IA no respondió a tiempo', 'AI_TIMEOUT')), ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Llamada estructurada con retry controlado (1 reintento) si el JSON no valida
async function structuredWithRetry(provider, messages, schemaHint, validator, maxTokens) {
  let tokensIn = 0;
  let tokensOut = 0;
  let attempts = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    attempts += 1;
    const res = await withTimeout(provider.generateStructured(messages, schemaHint, { maxTokens }), env.ai.timeoutMs);
    tokensIn += res.tokensIn || 0;
    tokensOut += res.tokensOut || 0;
    if (res.data !== null && res.data !== undefined) {
      const v = validator(res.data);
      if (v.ok) return { value: v.value, tokensIn, tokensOut, attempts };
    }
  }
  return { value: null, tokensIn, tokensOut, attempts };
}

// Auditoría de la interacción: solo metadatos (texto solo con AI_STORE_TEXT=true).
// Un fallo de registro nunca rompe la respuesta, pero en el flujo normal se espera.
async function recordInteraction(fields) {
  try {
    const doc = { ...fields };
    if (!env.ai.storeText) {
      delete doc.promptText;
      delete doc.responseText;
    }
    await Interaction.create(doc);
    return true;
  } catch {
    return false;
  }
}

function assertEnabled() {
  if (!env.ai.enabled) throw new ApiError(501, 'Módulo IA deshabilitado (AI_ENABLED=false)', 'AI_DISABLED');
}

function assertCompany(ctx) {
  if (!ctx.companyId) throw new ApiError(400, 'El usuario no tiene empresa asignada', 'COMPANY_REQUIRED');
}

// ---------------------------------------------------------------------------
// POST /ai/chat
// ---------------------------------------------------------------------------
async function chat(ctx, { question, sessionId } = {}) {
  assertEnabled();
  assertCompany(ctx);
  const sid = sessionId || crypto.randomUUID();
  try {
    limits.assertWithinLimits(ctx);
  } catch (err) {
    await recordInteraction({
      companyId: ctx.companyId, userId: ctx.userId, sessionId: sid,
      provider: env.ai.provider, model: env.ai.model || null, requestType: 'chat',
      promptMetadata: { questionLength: String(question || '').length, toolsAvailable: [], toolsUsed: [] },
      responseMetadata: { answerLength: 0, refused: false },
      tokensInput: 0, tokensOutput: 0, latencyMs: 0,
      status: 'RATE_LIMITED', errorCode: err.code
    });
    throw err;
  }

  const provider = createProvider(); // puede lanzar AI_NOT_CONFIGURED (503)
  const allowed = tools.allowedToolsFor(ctx.permissions);
  const systemPrompt = context.buildChatSystemPrompt(ctx, allowed);
  const t0 = Date.now();

  let tokensIn = 0;
  let tokensOut = 0;
  let toolsUsed = [];
  let answer = null;
  let refused = false;
  let status = 'OK';
  let errorCode = null;
  let recorded = false;

  const persist = async (extra = {}) => {
    recorded = await recordInteraction({
      companyId: ctx.companyId,
      userId: ctx.userId,
      sessionId: sid,
      provider: provider.name,
      model: provider.model,
      requestType: 'chat',
      promptMetadata: {
        questionLength: String(question || '').length,
        toolsAvailable: allowed.map((t) => t.name),
        toolsUsed,
        ...extra.promptMetadata
      },
      responseMetadata: { answerLength: answer ? answer.length : 0, refused, ...extra.responseMetadata },
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
      latencyMs: Date.now() - t0,
      status,
      errorCode,
      ...(env.ai.storeText ? { promptText: String(question || ''), responseText: answer || '' } : {})
    });
  };

  try {
    // Fase 1 — selección de herramienta (JSON estricto, retry 1×)
    const selection = await structuredWithRetry(
      provider,
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
      context.chatSelectionSchema(),
      validateChatSelection,
      Math.min(env.ai.maxTokens, 400)
    );
    tokensIn += selection.tokensIn;
    tokensOut += selection.tokensOut;

    if (!selection.value) {
      status = 'INVALID_RESPONSE';
      errorCode = 'AI_INVALID_RESPONSE';
      await persist();
      throw new ApiError(502, 'El proveedor devolvió una respuesta no válida', 'AI_INVALID_RESPONSE');
    }

    const sel = selection.value;
    if (sel.tool) {
      // Intersección de permisos en SERVIDOR: aunque el modelo pida una tool no
      // autorizada, no se ejecuta (propiedad testeable anti tool-abuse).
      if (!allowed.some((t) => t.name === sel.tool)) {
        status = 'ERROR';
        errorCode = 'AI_UNAUTHORIZED_TOOL';
        await persist();
        throw new ApiError(403, 'La IA solicitó una herramienta no autorizada', 'AI_UNAUTHORIZED_TOOL');
      }
      let data;
      try {
        data = await withTimeout(tools.executeTool(sel.tool, sel.params, ctx), env.ai.timeoutMs);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(502, 'Error al ejecutar la herramienta del ERP', 'AI_TOOL_ERROR');
      }
      toolsUsed = [sel.tool];

      // Fase 2 — síntesis basada solo en los datos devueltos por la tool
      const synth = await withTimeout(provider.generateText([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
        { role: 'system', content: context.toolDataMessage(sel.tool, data) }
      ], { maxTokens: env.ai.maxTokens }), env.ai.timeoutMs);
      tokensIn += synth.tokensIn || estTokens(systemPrompt);
      tokensOut += synth.tokensOut || estTokens(synth.text);
      answer = String(synth.text || '').trim() || 'El proveedor no devolvió contenido.';
    } else if (sel.directAnswer && sel.directAnswer.trim()) {
      answer = sel.directAnswer.trim();
    } else {
      answer = 'No dispongo de datos suficientes para responder a esa pregunta.';
      refused = true;
    }

    await persist();
    return {
      answer,
      sessionId: sid,
      toolsUsed,
      provider: provider.name,
      model: provider.model,
      latencyMs: Date.now() - t0
    };
  } catch (err) {
    const apiErr = err instanceof ApiError ? err : new ApiError(502, 'Error en el proveedor de IA', 'AI_PROVIDER_ERROR');
    if (!recorded) {
      status = apiErr.code === 'AI_TIMEOUT' ? 'TIMEOUT' : 'ERROR';
      errorCode = apiErr.code;
      await persist();
    }
    throw apiErr;
  }
}

// ---------------------------------------------------------------------------
// POST /ai/analyze
// ---------------------------------------------------------------------------
const ANALYZE_SOURCES = [
  'getSalesSummary', 'getInventoryStatus', 'getLowStockProducts',
  'getAccountsReceivable', 'getAccountsPayable', 'getPendingOrders',
  'getProductionSummary', 'getProjectSummary', 'getCRMOverview', 'getHRHeadcount'
];

async function analyze(ctx, { scope } = {}) {
  assertEnabled();
  assertCompany(ctx);
  const sid = crypto.randomUUID();
  try {
    limits.assertWithinLimits(ctx);
  } catch (err) {
    await recordInteraction({
      companyId: ctx.companyId, userId: ctx.userId, sessionId: sid,
      provider: env.ai.provider, model: env.ai.model || null, requestType: 'analyze',
      promptMetadata: { questionLength: 0, scope, toolsAvailable: [], toolsUsed: [] },
      responseMetadata: { answerLength: 0, refused: false },
      tokensInput: 0, tokensOutput: 0, latencyMs: 0,
      status: 'RATE_LIMITED', errorCode: err.code
    });
    throw err;
  }

  const provider = createProvider();
  const allowed = tools.allowedToolsFor(ctx.permissions);
  const allowedNames = new Set(allowed.map((t) => t.name));
  const sources = ANALYZE_SOURCES.filter((n) => allowedNames.has(n));
  if (sources.length === 0) {
    throw new ApiError(403, 'Sin acceso a datos del ERP para generar análisis', 'AI_NO_ACCESS');
  }

  const t0 = Date.now();
  let tokensIn = 0;
  let tokensOut = 0;
  let status = 'OK';
  let errorCode = null;
  let answerLength = 0;
  let recorded = false;
  let analysis = null;

  const persist = async () => {
    recorded = await recordInteraction({
      companyId: ctx.companyId,
      userId: ctx.userId,
      sessionId: sid,
      provider: provider.name,
      model: provider.model,
      requestType: 'analyze',
      promptMetadata: { questionLength: 0, scope, toolsAvailable: allowed.map((t) => t.name), toolsUsed },
      responseMetadata: { answerLength, refused: false },
      tokensInput: tokensIn,
      tokensOutput: tokensOut,
      latencyMs: Date.now() - t0,
      status,
      errorCode
    });
  };

  // Recopilación: cada tool con su permiso y companyId del contexto; fallos se omiten
  const sourcesData = {};
  const toolsUsed = [];
  for (const name of sources) {
    try {
      sourcesData[name] = await tools.executeTool(name, {}, ctx);
      toolsUsed.push(name);
    } catch {
      // una tool caída no invalida el análisis
    }
  }

  try {
    const result = await structuredWithRetry(
      provider,
      [
        { role: 'system', content: context.buildAnalysisSystemPrompt(ctx) },
        { role: 'user', content: context.analysisDataMessage({ scope: scope || 'general', ...sourcesData }) }
      ],
      context.analysisSchema(),
      validateAnalysis,
      env.ai.maxTokens
    );
    tokensIn += result.tokensIn;
    tokensOut += result.tokensOut;

    if (!result.value) {
      status = 'INVALID_RESPONSE';
      errorCode = 'AI_INVALID_RESPONSE';
      await persist();
      throw new ApiError(502, 'El proveedor devolvió un análisis no válido', 'AI_INVALID_RESPONSE');
    }
    analysis = result.value;
    answerLength = analysis.summary.length;
    await persist();
    return { analysis, sessionId: sid, toolsUsed, provider: provider.name, model: provider.model, latencyMs: Date.now() - t0 };
  } catch (err) {
    const apiErr = err instanceof ApiError ? err : new ApiError(502, 'Error en el proveedor de IA', 'AI_PROVIDER_ERROR');
    if (!recorded) {
      status = apiErr.code === 'AI_TIMEOUT' ? 'TIMEOUT' : 'ERROR';
      errorCode = apiErr.code;
      await persist();
    }
    throw apiErr;
  }
}

// ---------------------------------------------------------------------------
// GET /ai/health
// ---------------------------------------------------------------------------
async function health() {
  const cfg = env.ai;
  let check = { ok: false, provider: cfg.provider, model: cfg.model || null, detail: 'AI_DISABLED' };
  if (cfg.enabled) {
    try {
      check = await createProvider().healthCheck();
    } catch (err) {
      check = { ok: false, provider: cfg.provider, model: cfg.model || null, detail: err.message };
    }
  }
  return {
    enabled: cfg.enabled,
    provider: cfg.provider,
    model: cfg.model || (cfg.provider === 'mock' ? 'mock-v1' : null),
    configured: !!check.ok,
    detail: check.detail,
    limits: {
      rateLimitMax: cfg.rateLimitMax,
      dailyUserMax: cfg.dailyUserMax,
      dailyCompanyMax: cfg.dailyCompanyMax,
      maxTokens: cfg.maxTokens,
      timeoutMs: cfg.timeoutMs
    }
  };
}

module.exports = { chat, analyze, health };
