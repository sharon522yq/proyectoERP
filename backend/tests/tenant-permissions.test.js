const mongoose = require('mongoose');
const request = require('supertest');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
let db, app, a, b, admin, production, sales;
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri()); await ensureSeeded(); app = createApp();
  const Company = require('../src/modules/companies/company.model');
  a = await Company.create({ name: 'Empresa A' }); b = await Company.create({ name: 'Empresa B' });
  async function account(role, company, email) {
    return (await request(app).post('/api/v1/auth/register').send({ name: role, email, password: 'Password123', role, companyId: company._id })).body.data;
  }
  admin = await account('ADMIN', a, 'a@example.com');
  production = await account('PRODUCCION', a, 'p@example.com');
  sales = await account('VENTAS', a, 's@example.com');
}, 60000);
afterAll(async () => { await mongoose.disconnect(); await db.stop(); });
const authorized = (method, path, account = admin) => request(app)[method](path).set('Authorization', `Bearer ${account.accessToken}`);
test('empresa A no lista ni consulta ni modifica B', async () => {
  const list = await authorized('get', '/api/v1/companies');
  expect(list.body.data.map(c => c._id)).toEqual([String(a._id)]);
  expect((await authorized('get', `/api/v1/companies/${b._id}`)).status).toBe(403);
  expect((await authorized('put', `/api/v1/companies/${b._id}`).send({ name: 'Intrusión' })).status).toBe(403);
});
test('administrador de empresa no crea usuarios globales ni en otra empresa', async () => {
  const body = { name: 'Nuevo', email: 'new@example.com', password: 'Password123', role: 'SUPER_ADMIN' };
  expect((await authorized('post', '/api/v1/users').send(body)).status).toBe(403);
  expect((await authorized('post', '/api/v1/users').send({ ...body, role: 'EMPLEADO', companyId: b._id })).status).toBe(403);
});
test('producción usa sus permisos y ventas obtiene solo su resumen', async () => {
  expect((await authorized('get', '/api/v1/production/orders', production)).status).toBe(200);
  const summary = await authorized('get', '/api/v1/dashboard', sales);
  expect(summary.status).toBe(200); expect(summary.body.data.sales).toBeDefined();
  expect(summary.body.data.finance).toBeUndefined(); expect(summary.body.data.hr).toBeUndefined();
});
test('actualización no puede mover un proyecto a otra empresa', async () => {
  const created = await authorized('post', '/api/v1/projects').send({ name: 'Proyecto A' });
  const changed = await authorized('put', `/api/v1/projects/${created.body.data._id}`).send({ name: 'Editado', companyId: b._id });
  expect(changed.status).toBe(200); expect(changed.body.data.companyId).toBe(String(a._id));
});

test('optional module configuration is tenant scoped, enforced in API and does not grant permissions', async () => {
  expect((await authorized('put', '/api/v1/settings').send({ key: 'modulePreferences', value: { enabledModules: ['users'] } })).status).toBe(400);
  const foreign = (await request(app).post('/api/v1/auth/register').send({ name: 'Foreign Admin', email: 'b@example.com', password: 'Password123', role: 'ADMIN', companyId: b._id })).body.data;
  expect((await authorized('put', '/api/v1/settings').send({ key: 'modulePreferences', value: { enabledModules: [] } })).status).toBe(200);
  expect((await authorized('get', '/api/v1/production/orders', production)).body.code).toBe('MODULE_DISABLED');
  expect((await authorized('get', '/api/v1/production/orders', foreign)).status).toBe(200);
  const summary = await authorized('get', '/api/v1/dashboard');
  expect(summary.body.data.enabledModules).toEqual([]); expect(summary.body.data.production).toBeUndefined();
  expect((await authorized('put', '/api/v1/settings', sales).send({ key: 'modulePreferences', value: { enabledModules: ['production'] } })).status).toBe(403);
  await authorized('put', '/api/v1/settings').send({ key: 'modulePreferences', value: { enabledModules: ['production'] } });
  expect((await authorized('get', '/api/v1/production/orders', production)).status).toBe(200);
  expect((await authorized('get', '/api/v1/production/orders', sales)).status).toBe(403);
});
