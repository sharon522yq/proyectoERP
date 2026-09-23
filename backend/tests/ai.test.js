/**
 * FASE 12 — Tests funcionales de integración del módulo IA.
 * Cubre: health, RBAC (401/403), chat con tools, respuesta directa, "datos
 * insuficientes", rechazo de tool no autorizada (GERENTE sin permiso de
 * producción), validación de parámetros de tool (IDOR), /analyze estructurado,
 * validación de entrada 400 y auditoría en ai_interactions.
 * Proveedor: mock (determinista, sin claves) — ejercita la tubería completa.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app;
let adminToken, gerenteToken, empleadoToken;
const stamp = Date.now();
const sessionId = `sess${stamp}`;

async function registerWithCompany(email, name, role, companyId) {
  await request(app).post('/api/v1/auth/register').send({ name, email, password: 'Password123', role });
  let login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  if (!companyId) {
    const comp = await request(app).post('/api/v1/companies')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ name: `${name} Co ${stamp}` });
    companyId = comp.body.data._id;
  }
  await require('../src/modules/users/user.model').updateOne({ email }, { $set: { companyId } });
  login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  return { token: login.body.data.accessToken, companyId };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  const a = await registerWithCompany(`ai-admin-${stamp}@test.com`, 'AI Admin', 'ADMIN');
  adminToken = a.token;
  gerenteToken = (await registerWithCompany(`ai-ger-${stamp}@test.com`, 'AI Gerente', 'GERENTE', a.companyId)).token;
  empleadoToken = (await registerWithCompany(`ai-emp-${stamp}@test.com`, 'AI Empleado', 'EMPLEADO', a.companyId)).token;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('GET /api/v1/ai/health', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/ai/health');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  test('con ai.read → proveedor mock reportado, sin secretos', async () => {
    const res = await request(app).get('/api/v1/ai/health')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.provider).toBe('mock');
    expect(res.body.data.configured).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('apiKey');
    expect(res.body.data.limits.maxTokens).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/ai/chat — RBAC y funcionalidad', () => {
  test('sin token → 401 con formato de error', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({ question: 'Hola' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  test('EMPLEADO sin ai.chat → 403 FORBIDDEN', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${empleadoToken}`)
      .send({ question: 'Hola' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('saludo → respuesta directa sin tools', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'Hola' });
    expect(res.status).toBe(200);
    expect(res.body.data.answer).toContain('asistente');
    expect(res.body.data.toolsUsed).toEqual([]);
    expect(res.body.data.provider).toBe('mock');
  });

  test('pregunta de ventas → ejecuta getSalesSummary y respeta sessionId', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: '¿Cuánto vendimos este mes?', sessionId });
    expect(res.status).toBe(200);
    expect(res.body.data.toolsUsed).toEqual(['getSalesSummary']);
    expect(res.body.data.answer).toContain('totalInvoiced');
    expect(res.body.data.sessionId).toBe(sessionId);
    expect(res.body.data.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('pregunta sin datos disponibles → respuesta "datos insuficientes" (no inventa)', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: '¿Cuál es el color del cielo?' });
    expect(res.status).toBe(200);
    expect(res.body.data.answer).toContain('No dispongo de datos suficientes');
    expect(res.body.data.toolsUsed).toEqual([]);
  });

  test('parámetro de tool fuera de rango → 400 AI_TOOL_PARAMS (sin pasar al modelo)', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'FORCE_TOOL:getLowStockProducts:{"top":999999}' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('AI_TOOL_PARAMS');
  });

  test('GERENTE pide tool de producción sin permiso → 403 AI_UNAUTHORIZED_TOOL', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${gerenteToken}`)
      .send({ question: '¿Cuál es el estado de producción?' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_UNAUTHORIZED_TOOL');
  });
});

describe('POST /api/v1/ai/analyze', () => {
  test('análisis estructurado con forma correcta', async () => {
    const res = await request(app).post('/api/v1/ai/analyze')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);
    const a = res.body.data.analysis;
    expect(a.type).toBe('analysis');
    expect(typeof a.summary).toBe('string');
    expect(Array.isArray(a.findings)).toBe(true);
    expect(Array.isArray(a.recommendations)).toBe(true);
    expect(a.confidence).toBeNull();
    expect(res.body.data.toolsUsed.length).toBeGreaterThan(0);
    expect(res.body.data.provider).toBe('mock');
  });
});

describe('Validación de entrada', () => {
  test('question ausente → 400', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('question de 1 carácter → 400', async () => {
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('Auditoría ai_interactions + unidades', () => {
  test('cada chat queda registrado con metadatos y sin texto almacenado', async () => {
    const Interaction = require('../src/modules/ai/ai.interaction.model');
    const doc = await Interaction.findOne({ sessionId }).lean();
    expect(doc).toBeTruthy();
    expect(doc.provider).toBe('mock');
    expect(doc.requestType).toBe('chat');
    expect(doc.status).toBe('OK');
    expect(doc.promptMetadata.toolsUsed).toEqual(['getSalesSummary']);
    expect(doc.tokensInput).toBeGreaterThan(0);
    expect(doc.latencyMs).toBeGreaterThanOrEqual(0);
    expect(doc.companyId).toBeTruthy();
    expect(doc.userId).toBeTruthy();
    // Política: no se guarda el texto del prompt por defecto
    const withText = await Interaction.findOne({ sessionId }).select('+promptText +responseText');
    expect(withText.promptText).toBeUndefined();
    expect(withText.responseText).toBeUndefined();
  });

  test('el registro de tool no autorizada queda en la auditoría', async () => {
    const Interaction = require('../src/modules/ai/ai.interaction.model');
    const doc = await Interaction.findOne({ status: 'ERROR', errorCode: 'AI_UNAUTHORIZED_TOOL' }).lean();
    expect(doc).toBeTruthy();
    expect(doc.companyId).toBeTruthy();
  });

  test('validateChatSelection acepta forma válida y rechaza inválida', () => {
    const { validateChatSelection } = require('../src/modules/ai/ai.schemas');
    expect(validateChatSelection({ tool: null, params: {}, directAnswer: 'hola' }).ok).toBe(true);
    expect(validateChatSelection({ tool: 'getSalesSummary', params: {} }).ok).toBe(true);
    expect(validateChatSelection({ tool: 123 }).ok).toBe(false);
    expect(validateChatSelection('texto').ok).toBe(false);
    expect(validateChatSelection({ tool: 'x', params: 'nope' }).ok).toBe(false);
  });

  test('validateAnalysis valida la forma de análisis', () => {
    const { validateAnalysis } = require('../src/modules/ai/ai.schemas');
    const good = { type: 'analysis', summary: 'ok', findings: ['a'], recommendations: [], confidence: null };
    expect(validateAnalysis(good).ok).toBe(true);
    expect(validateAnalysis({ ...good, type: 'x' }).ok).toBe(false);
    expect(validateAnalysis({ ...good, findings: 'no-array' }).ok).toBe(false);
    expect(validateAnalysis({ ...good, confidence: 5 }).ok).toBe(false);
  });

  test('allowedToolsFor filtra estrictamente por permisos', () => {
    const { allowedToolsFor } = require('../src/modules/ai/ai.tools');
    expect(allowedToolsFor([])).toHaveLength(0);
    const inv = allowedToolsFor(['inventory.read']);
    expect(inv.length).toBeGreaterThan(0);
    for (const t of inv) expect(t.requiredPermission).toBe('inventory.read');
    expect(allowedToolsFor(['*']).length).toBeGreaterThanOrEqual(inv.length);
  });
});
