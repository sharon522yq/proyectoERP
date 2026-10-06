/**
 * FASE 12 — Rate limiting específico de IA (AI_RATE_LIMIT_MAX por IP/ventana).
 * El límite debe configurarse ANTES de crear la app (se fija al construir el limiter).
 */
process.env.AI_RATE_LIMIT_MAX = '2';
process.env.AI_DAILY_USER_MAX = '1000';

const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token;
const stamp = Date.now();

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  const email = `ai-rl-${stamp}@test.com`;
  await request(app).post('/api/v1/auth/register').send({ name: 'AI RL', email, password: 'Password123', role: 'ADMIN' });
  let login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  const comp = await request(app).post('/api/v1/companies')
    .set('Authorization', `Bearer ${login.body.data.accessToken}`)
    .send({ name: `AI RL Co ${stamp}` });
  await require('../src/modules/users/user.model').updateOne({ email }, { $set: { companyId: comp.body.data._id } });
  login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Rate limit IA (AI_RATE_LIMIT_MAX=2)', () => {
  test('3ª petición de chat → 429 AI_RATE_LIMIT con formato de error estándar', async () => {
    const chat = () => request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'Hola asistente' });

    expect((await chat()).status).toBe(200);
    expect((await chat()).status).toBe(200);

    const third = await chat();
    expect(third.status).toBe(429);
    expect(third.body.success).toBe(false);
    expect(typeof third.body.message).toBe('string');
    expect(third.body.code).toBe('AI_RATE_LIMIT');
  });

  test('/ai/health no consume el rate limit de IA', async () => {
    const res = await request(app).get('/api/v1/ai/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
