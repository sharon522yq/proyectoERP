const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const User = require('../src/modules/users/user.model');

let mongo;
let app;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  app = createApp();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('Refresh Token', () => {
  test('rotación invalida token viejo', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Refresh Test', email: 'refreshtest@test.com', password: 'Password123', role: 'ADMIN'
    });
    expect(reg.status).toBe(201);

    const login = await request(app).post('/api/auth/login').send({ email: 'refreshtest@test.com', password: 'Password123' });
    expect(login.status).toBe(200);
    expect(login.body.data.refreshToken).toBeDefined();

    const oldRefresh = login.body.data.refreshToken;
    const oldHash = crypto.createHash('sha256').update(oldRefresh).digest('hex');

    // Verificar hash en DB
    const userBefore = await User.findById(login.body.data.user._id).select('+refreshTokenHash');
    expect(userBefore.refreshTokenHash).toBe(oldHash);

    // Primer refresh → 200
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(r1.status).toBe(200);

    // Hash cambió
    const userAfter = await User.findById(login.body.data.user._id).select('+refreshTokenHash');
    expect(userAfter.refreshTokenHash).not.toBe(oldHash);

    // Reuso → 401
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(r2.status).toBe(401);
  });
});
