const { createTestDatabase } = require('./helpers/database');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo, app, token, companyId;

beforeAll(async () => {
  mongo = await createTestDatabase();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  await request(app).post('/api/v1/auth/register').send({ name: 'Proj Admin', email: 'projadmin@test.com', password: 'Password123', role: 'ADMIN' });
  const comp = { body: { data: await require('../src/modules/companies/company.model').create({ name: 'Proj Test Co' }) } };
  companyId = comp.body.data._id;
  await require('../src/modules/users/user.model').updateOne({ email: 'projadmin@test.com' }, { $set: { companyId } });
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'projadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('Projects', () => {
  let projectId, taskId;

  test('crear proyecto', async () => {
    const res = await request(app).post('/api/v1/projects').set('Authorization', `Bearer ${token}`).send({
      name: 'Implementar ERP', description: 'Proyecto principal', budget: 50000
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Implementar ERP');
    projectId = res.body.data._id;
  });

  test('listar proyectos', async () => {
    const res = await request(app).get('/api/v1/projects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('actualizar proyecto', async () => {
    const res = await request(app).put(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${token}`).send({ status: 'ACTIVE', progress: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  test('crear tarea', async () => {
    const res = await request(app).post('/api/v1/projects/tasks').set('Authorization', `Bearer ${token}`).send({
      projectId, title: 'Diseñar base de datos', priority: 'HIGH'
    });
    expect(res.status).toBe(201);
    taskId = res.body.data._id;
  });

  test('listar tareas', async () => {
    const res = await request(app).get('/api/v1/projects/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('actualizar tarea', async () => {
    const res = await request(app).put(`/api/v1/projects/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });
});

describe('Security - Projects', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });
});

test('project completion is blocked by pending tasks and closed projects reject new tasks', async () => {
  const auth = { Authorization: 'Bearer ' + token };
  const created = await request(app).post('/api/v1/projects').set(auth).send({ name: 'Proyecto de cierre' });
  const id = created.body.data._id;
  const task = await request(app).post('/api/v1/projects/tasks').set(auth).send({ projectId: id, title: 'Pendiente de cierre' });
  expect((await request(app).put('/api/v1/projects/' + id).set(auth).send({ status: 'COMPLETED' })).body.code).toBe('PROJECT_TASKS_PENDING');
  expect((await request(app).put('/api/v1/projects/tasks/' + task.body.data._id).set(auth).send({ status: 'DONE' })).status).toBe(200);
  expect((await request(app).put('/api/v1/projects/' + id).set(auth).send({ status: 'COMPLETED' })).status).toBe(200);
  expect((await request(app).post('/api/v1/projects/tasks').set(auth).send({ projectId: id, title: 'No admitida' })).body.code).toBe('PROJECT_CLOSED');
  expect((await request(app).put('/api/v1/projects/tasks/' + task.body.data._id).set(auth).send({ status: 'TODO' })).body.code).toBe('PROJECT_CLOSED');
});
