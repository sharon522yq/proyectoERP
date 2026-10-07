const mongoose = require('mongoose');
const request = require('supertest');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
let db, app, company, foreign, admin, employee;
const call = (method, path, account = admin) => request(app)[method]('/api/v1' + path).set('Authorization', 'Bearer ' + account.accessToken);
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri()); await ensureSeeded(); app = createApp();
  const Company = require('../src/modules/companies/company.model');
  company = await Company.create({ name: 'Catalog QA' }); foreign = await Company.create({ name: 'Other QA' });
  async function register(role, email) { return (await request(app).post('/api/v1/auth/register').send({name: role, email, password: 'SyntheticOnly123', role, companyId: company._id})).body.data; }
  admin = await register('ADMIN', 'catalog@example.invalid'); employee = await register('EMPLEADO', 'catalog-reader@example.invalid');
}, 60000);
afterAll(async () => { await mongoose.disconnect(); if(db) await db.stop(); });
const product = async sku => (await call('post','/products').send({ name: sku, sku, price: 10 })).body.data;
const warehouse = async code => (await call('post','/inventory/warehouses').send({ name: code, code })).body.data;
test('lead removal survives reload and preserves its converted customer', async () => {
  const lead = (await call('post','/crm/leads').send({name:'Converted QA'})).body.data;
  const customer = (await call('post', '/crm/leads/'+lead._id+'/convert')).body.data;
  expect((await call('delete','/crm/leads/'+lead._id)).status).toBe(200);
  expect((await call('get','/crm/leads')).body.data.items.some(l=>l._id===lead._id)).toBe(false);
  expect((await call('get','/crm/leads/'+lead._id)).status).toBe(404);
  expect((await call('get','/crm/customers/'+customer._id)).status).toBe(200);
  expect((await call('post','/crm/leads/'+lead._id+'/convert')).status).toBe(404);
});
test('unused product is removed and cannot be selected by id afterward', async () => {
  const p = await product('UNUSED'); expect((await call('delete','/products/'+p._id)).status).toBe(200);
  expect((await call('get','/products/'+p._id)).status).toBe(404);
  expect((await call('get','/products')).body.data.items.some(x=>x._id===p._id)).toBe(false);
});
test('stock and history block product deletion; deactivation preserves them', async () => {
  const p=await product('USED'), w=await warehouse('USED-WH');
  const adjust = { productId:p._id,warehouseId:w._id,quantity:2,type:'ADJUSTMENT',reason:'Synthetic stock' };
  expect((await call('post','/inventory/stock/adjust').send(adjust)).status).toBe(200);
  expect((await call('delete','/products/'+p._id)).status).toBe(409);
  expect((await call('put','/products/'+p._id).send({status:'INACTIVE'})).status).toBe(200);
  expect((await call('get','/inventory/stock',{...admin})).body.data.items.find(s=>s.productId===p._id).quantity).toBe(2);
  expect((await call('get','/products').query({status:'ACTIVE'})).body.data.items.some(x=>x._id===p._id)).toBe(false);
});
test('sales documents independently block removal and inactive products reject new quotes', async () => {
  const p=await product('QUOTED');
  const c=(await call('post','/crm/customers').send({name:'QA Customer'})).body.data;
  const quote={customerId:c._id,items:[{productId:p._id,quantity:1,unitPrice:10,taxRate:0}]};
  expect((await call('post','/sales/quotes').send(quote)).status).toBe(201);
  expect((await call('delete','/products/'+p._id)).status).toBe(409);
  await call('put','/products/'+p._id).send({status:'INACTIVE'});
  expect((await call('post','/sales/quotes').send(quote)).status).toBe(404);
});
test('warehouse editing ignores company reassignment, supports inactive state and safe removal', async () => {
  const w=await warehouse('EMPTY');
  const update=await call('put','/inventory/warehouses/'+w._id).send({name:'Edited QA',address:'Synthetic address',companyId:foreign._id});
  expect(update.status).toBe(200); expect(update.body.data.companyId).toBe(String(company._id));
  expect((await call('put','/inventory/warehouses/'+w._id).send({active:false})).body.data.active).toBe(false);
  const p=await product('INACTIVE-WH');
  expect((await call('post','/inventory/stock/adjust').send({productId:p._id,warehouseId:w._id,quantity:1,type:'ADJUSTMENT'})).status).toBe(409);
  await call('put','/inventory/warehouses/'+w._id).send({active:true});
  expect((await call('delete','/inventory/warehouses/'+w._id)).status).toBe(200);
  expect((await call('get','/inventory/warehouses/'+w._id)).status).toBe(404);
  expect((await call('get','/inventory/warehouses')).body.data.some(x=>x._id===w._id)).toBe(false);
});
test('occupied warehouse cannot be removed or deactivated; movement history remains after emptying', async () => {
  const p=await product('WH-HISTORY'),w=await warehouse('HISTORY');
  const payload={productId:p._id,warehouseId:w._id,quantity:1,type:'ADJUSTMENT',reason:'QA'};
  await call('post','/inventory/stock/adjust').send(payload);
  expect((await call('put','/inventory/warehouses/'+w._id).send({active:false})).status).toBe(409);
  expect((await call('delete','/inventory/warehouses/'+w._id)).status).toBe(409);
  await call('post','/inventory/stock/adjust').send({...payload,type:'SALE_EXIT'});
  expect((await call('put','/inventory/warehouses/'+w._id).send({active:false})).status).toBe(200);
  expect((await call('delete','/inventory/warehouses/'+w._id)).status).toBe(409);
  const history=await call('get','/inventory/movements').query({warehouseId:w._id});
  expect(history.body.data.total).toBe(2);
});
test('cross-company and insufficient permissions reject management actions', async () => {
  const w=await require('../src/modules/inventory/warehouse.model').create({name:'Foreign',code:'FOREIGN',companyId:foreign._id});
  const p=await require('../src/modules/products/product.model').create({name:'Foreign',sku:'FOREIGN',price:10,companyId:foreign._id});
  const l=await require('../src/modules/crm/lead.model').create({name:'Foreign',companyId:foreign._id});
  for(const path of ['/inventory/warehouses/'+w._id,'/products/'+p._id,'/crm/leads/'+l._id]) {
    expect((await call('delete',path)).status).toBe(404);
    expect((await call('delete',path,employee)).status).toBe(403);
  }
  expect((await call('put','/inventory/warehouses/'+w._id).send({name:'Intrusion'})).status).toBe(404);
  expect((await call('put','/inventory/warehouses/'+w._id,employee).send({name:'Intrusion'})).status).toBe(403);
});
test('management operations produce scoped audit records and validate warehouse fields', async () => {
  const records=await require('../src/modules/audit/audit.model').find({companyId:company._id,module:'inventory.warehouses'});
  expect(records.some(r=>r.action==='DELETE')).toBe(true); expect(records.some(r=>r.action==='UPDATE')).toBe(true);
  const w=await warehouse('VALIDATION');
  expect((await call('put','/inventory/warehouses/'+w._id).send({name:''})).status).toBe(400);
  expect((await call('put','/inventory/warehouses/'+w._id).send({active:'invalid'})).status).toBe(400);
  expect((await call('post','/inventory/warehouses').send({name:'Duplicate',code:'VALIDATION'})).status).toBe(409);
  expect((await call('put','/inventory/warehouses/'+w._id).send({code:'HISTORY'})).status).toBe(409);
});
