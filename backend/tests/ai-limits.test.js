/**
 * FASE 12 — Control de coste: límites diarios por usuario/empresa y kill-switch.
 * Los límites se leen de env.ai en cada llamada (mutables en runtime para el test).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');
const env = require('../src/config/env');
const limits = require('../src/modules/ai/ai.limits');

let mongo, app, token;
const stamp = Date.now();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  const email = `ai-lim-${stamp}@test.com`;
  await request(app).post('/api/v1/auth/register').send({ name: 'AI Limit', email, password: 'Password123', role: 'ADMIN' });
  let login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  const comp = await request(app).post('/api/v1/companies')
    .set('Authorization', `Bearer ${login.body.data.accessToken}`)
    .send({ name: `AI Limit Co ${stamp}` });
  await require('../src/modules/users/user.model').updateOne({ email }, { $set: { companyId: comp.body.data._id } });
  login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

const chat = (q = 'Hola, ¿puedes ayudarme?') =>
  request(app).post('/api/v1/ai/chat').set('Authorization', `Bearer ${token}`).send({ question: q });

describe('Límites diarios de IA (cost control)', () => {
  test('límite diario por usuario → 429 AI_DAILY_LIMIT + registro RATE_LIMITED', async () => {
    const prevUser = env.ai.dailyUserMax;
    const prevCompany = env.ai.dailyCompanyMax;
    env.ai.dailyUserMax = 1;
    env.ai.dailyCompanyMax = 1000;
    limits.resetLimits();
    try {
      const first = await chat();
      expect(first.status).toBe(200);

      const second = await chat('¿Cuánto vendimos este mes?');
      expect(second.status).toBe(429);
      expect(second.body.success).toBe(false);
      expect(second.body.code).toBe('AI_DAILY_LIMIT');
    } finally {
      env.ai.dailyUserMax = prevUser;
      env.ai.dailyCompanyMax = prevCompany;
    }
    const Interaction = require('../src/modules/ai/ai.interaction.model');
    const doc = await Interaction.findOne({ status: 'RATE_LIMITED', errorCode: 'AI_DAILY_LIMIT' }).lean();
    expect(doc).toBeTruthy();
  });

  test('límite diario por empresa → 429 AI_DAILY_LIMIT', async () => {
    const prevUser = env.ai.dailyUserMax;
    const prevCompany = env.ai.dailyCompanyMax;
    env.ai.dailyUserMax = 1000;
    env.ai.dailyCompanyMax = 1;
    limits.resetLimits();
    try {
      const first = await chat();
      expect(first.status).toBe(200);

      const second = await chat();
      expect(second.status).toBe(429);
      expect(second.body.code).toBe('AI_DAILY_LIMIT');
    } finally {
      env.ai.dailyUserMax = prevUser;
      env.ai.dailyCompanyMax = prevCompany;
    }
  });
});

describe('Kill-switch AI_ENABLED=false', () => {
  test('chat → 501 AI_DISABLED y health lo refleja', async () => {
    const prev = env.ai.enabled;
    env.ai.enabled = false;
    try {
      const res = await chat();
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AI_DISABLED');

      const health = await request(app).get('/api/v1/ai/health')
        .set('Authorization', `Bearer ${token}`);
      expect(health.status).toBe(200);
      expect(health.body.data.enabled).toBe(false);
      expect(health.body.data.detail).toBe('AI_DISABLED');
    } finally {
      env.ai.enabled = prev;
    }
  });

  test('tras reactivar, el chat vuelve a funcionar', async () => {
    const res = await chat();
    expect(res.status).toBe(200);
    expect(res.body.data.answer).toBeTruthy();
  });
});
