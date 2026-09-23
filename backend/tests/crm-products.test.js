const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('../src/modules/products/unit.service');

let mongo;
let app;
let token;
let companyId;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await seedUnits();
  app = createApp();

  // 1. Register admin user
  const reg = await request(app).post('/api/v1/auth/register').send({
    name: 'CRM Test Admin', email: 'crmadmin@test.com', password: 'Password123', role: 'ADMIN'
  });
  token = reg.body.data.accessToken;

  // 2. Create a company
  const comp = await request(app).post('/api/v1/companies').set('Authorization', `Bearer ${token}`).send({ name: 'CRM Test Co' });
  companyId = comp.body.data._id;

  // 3. Assign companyId to user in DB
  const User = require('../src/modules/users/user.model');
  await User.updateOne({ email: 'crmadmin@test.com' }, { $set: { companyId } });

  // 4. Re-login to get a fresh token with companyId
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'crmadmin@test.com', password: 'Password123' });
  token = login.body.data.accessToken;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('CRM - Leads', () => {
  let leadId;

  test('crear lead', async () => {
    const res = await request(app).post('/api/v1/crm/leads').set('Authorization', `Bearer ${token}`).send({
      name: 'Juan Pérez', email: 'juan@test.com', phone: '5551234', source: 'WEB', priority: 'HIGH'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Juan Pérez');
    leadId = res.body.data._id;
  });

  test('listar leads', async () => {
    const res = await request(app).get('/api/v1/crm/leads').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('obtener lead por id', async () => {
    const res = await request(app).get(`/api/v1/crm/leads/${leadId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(leadId);
  });

  test('actualizar lead', async () => {
    const res = await request(app).put(`/api/v1/crm/leads/${leadId}`).set('Authorization', `Bearer ${token}`).send({ status: 'CONTACTED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONTACTED');
  });

  test('convertir lead a customer', async () => {
    const res = await request(app).post(`/api/v1/crm/leads/${leadId}/convert`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Juan Pérez');
  });

  test('lead ya convertido no se puede reconvertir', async () => {
    const res = await request(app).post(`/api/v1/crm/leads/${leadId}/convert`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('CRM - Customers', () => {
  let customerId;

  test('crear customer', async () => {
    const res = await request(app).post('/api/v1/crm/customers').set('Authorization', `Bearer ${token}`).send({
      name: 'Empresa ABC', email: 'abc@test.com', type: 'BUSINESS'
    });
    expect(res.status).toBe(201);
    customerId = res.body.data._id;
  });

  test('listar customers', async () => {
    const res = await request(app).get('/api/v1/crm/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('crear contact para customer', async () => {
    const res = await request(app).post(`/api/v1/crm/customers/${customerId}/contacts`).set('Authorization', `Bearer ${token}`).send({
      name: 'María López', email: 'maria@test.com', position: 'Gerente'
    });
    expect(res.status).toBe(201);
  });

  test('listar contacts de customer', async () => {
    const res = await request(app).get(`/api/v1/crm/customers/${customerId}/contacts`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CRM - Activities', () => {
  test('crear activity', async () => {
    const res = await request(app).post('/api/v1/crm/activities').set('Authorization', `Bearer ${token}`).send({
      type: 'CALL', subject: 'Llamada de seguimiento', description: 'Hablar con el cliente sobre presupuesto'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('CALL');
  });

  test('listar activities', async () => {
    const res = await request(app).get('/api/v1/crm/activities').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Products - Categories', () => {
  let catId;

  test('crear categoría', async () => {
    const res = await request(app).post('/api/v1/products/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Electrónica' });
    expect(res.status).toBe(201);
    catId = res.body.data._id;
  });

  test('listar categorías', async () => {
    const res = await request(app).get('/api/v1/products/categories').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Products - Products', () => {
  test('crear producto', async () => {
    const res = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({
      sku: 'LAPTOP-001', name: 'Laptop Dell', price: 15999.99, cost: 12000, taxRate: 16, minimumStock: 5
    });
    expect(res.status).toBe(201);
    expect(res.body.data.sku).toBe('LAPTOP-001');
  });

  test('SKU duplicado rechazado', async () => {
    const res = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token}`).send({
      sku: 'LAPTOP-001', name: 'Laptop Dell 2', price: 16000
    });
    expect(res.status).toBe(409);
  });

  test('listar productos', async () => {
    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test('buscar producto por SKU', async () => {
    const res = await request(app).get('/api/v1/products?search=LAPTOP').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
  });
});

describe('Security - CRM', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/v1/crm/leads');
    expect(res.status).toBe(401);
  });
});
