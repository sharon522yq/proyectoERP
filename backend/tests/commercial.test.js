const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const User = require('../src/modules/users/user.model');
const Company = require('../src/modules/companies/company.model');
const { Contract, Token, Mail, Event, Membership, Payment } = require('../src/modules/commercial/models');
const service = require('../src/modules/commercial/service');
const provider = require('../src/modules/commercial/provider');
const { checkoutConfig } = require('../src/modules/commercial/catalog');
let mongo, app;
const password = 'Password123';
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');

beforeAll(async () => {
  process.env.ALLOW_PRIVILEGED_REGISTER = 'false';
  process.env.COMMERCIAL_AMOUNT_MINOR = '10000'; // Explicit fixture, not a commercial price.
  process.env.COMMERCIAL_MODE = 'test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
  process.env.STRIPE_PRICE_ID = 'price_fixture';
  process.env.FRONTEND_URL = 'http://localhost:19006';
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  await Promise.all([User.init(), Contract.init(), Token.init(), Event.init(), Membership.init(), Payment.init(), Mail.init()]);
  app = createApp();
}, 60000);
afterAll(async () => { jest.restoreAllMocks(); await mongoose.disconnect(); if (mongo) await mongo.stop(); });
afterEach(() => jest.restoreAllMocks());

test('empresa heredada se selecciona sin backfill ni creación de membresías y no permite otra empresa', async () => {
  const company = await Company.create({ name: 'Heredada QA' });
  const other = await Company.create({ name: 'Otra heredada QA' });
  const user = await User.create({ name: 'Legacy QA', email: 'legacy-select@example.com', passwordHash: 'test-only-unused-hash', role: 'VENTAS', companyId: company._id });
  const before = await Membership.countDocuments({ userId: user._id });
  const companies = await service.memberships(user._id);
  expect(companies).toHaveLength(1);
  expect(String(companies[0].companyId._id)).toBe(String(company._id));
  await service.switchCompany(user._id, company._id);
  await expect(service.switchCompany(user._id, other._id)).rejects.toMatchObject({ code: 'CROSS_COMPANY' });
  expect(await Membership.countDocuments({ userId: user._id })).toBe(before);
  expect(String((await User.findById(user._id)).companyId)).toBe(String(company._id));
});

test('reducir el rol actual actualiza la membresía y cambiar de empresa no recupera privilegios anteriores', async () => {
  const [company, other] = await Company.create([{ name: 'Rol reducido QA' }, { name: 'Segunda QA' }]);
  const user = await User.create({ name: 'Role QA', email: 'role-select@example.com', passwordHash: 'test-only-unused-hash', role: 'ADMIN', companyId: company._id });
  await Membership.create([{ userId: user._id, companyId: company._id, role: 'ADMIN', commercial: false }, { userId: user._id, companyId: other._id, role: 'VENTAS', commercial: false }]);
  await require('../src/modules/users/user.service').update(user._id, { role: 'EMPLEADO' }, { userId: new mongoose.Types.ObjectId(), companyId: company._id, role: 'ADMIN' });
  expect((await Membership.findOne({ userId: user._id, companyId: company._id })).role).toBe('EMPLEADO');
  await service.switchCompany(user._id, other._id);
  await service.switchCompany(user._id, company._id);
  expect((await User.findById(user._id)).role).toBe('EMPLEADO');
});

async function register(email) {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Cliente Prueba', email,
    password, confirmPassword: password, companyName: 'Empresa Prueba', acceptTerms: true, termsVersion: 'draft-2026-10-05' });
  expect(response.status).toBe(201);
  return response.body.data;
}
async function verifyUser(user) {
  const mail = await Mail.findOne({ to: user.user.email }).select('+text');
  const token = mail.text.split('token=')[1];
  const response = await request(app).post('/api/v1/commercial/verify').send({ token });
  expect(response.status).toBe(200);
  return token;
}

function snapshot(contract, overrides = {}) {
  const periodEnd = Math.floor(Date.now() / 1000) + 86400;
  const session = { id: `cs_${contract.id}`, client_reference_id: contract.id, metadata: { contractId: contract.id },
    currency: 'mxn', amount_total: 10000, livemode: false, status: 'complete', subscription: `sub_${contract.id}` };
  const subscription = { id: session.subscription, metadata: { contractId: contract.id }, status: 'active',
    items: { data: [{ quantity: 1, price: { unit_amount: 10000, currency: 'mxn', recurring: { interval: 'month' } } }] },
    current_period_end: periodEnd, customer: `cus_${contract.id}`, latest_invoice: `in_${contract.id}`, cancel_at_period_end: false,
    ...overrides };
  jest.spyOn(provider, 'stripe').mockImplementation(async path => {
    if (path.startsWith('checkout/')) return session;
    if (path.startsWith('subscriptions/')) return subscription;
    if (path.startsWith('invoices/')) return { paid: true, amount_paid: 10000, currency: 'mxn', subscription: session.subscription };
    throw new Error(`Unexpected path ${path}`);
  });
  return { session, subscription };
}

test('registro público rechaza privilegios; pendientes no acceden al ERP', async () => {
  const malicious = await request(app).post('/api/v1/auth/register').send({ name: 'Cliente', email: 'attack@example.com', password, role: 'SUPER_ADMIN' });
  expect(malicious.status).toBe(400);
  const user = await register('pending@example.com');
  const blocked = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${user.accessToken}`);
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('ACTIVATION_REQUIRED');
  const duplicate = await request(app).post('/api/v1/auth/register').send({ name: 'Cliente', email: 'PENDING@example.com', password, confirmPassword: password, companyName: 'Otra', acceptTerms: true, termsVersion: 'draft-2026-10-05' });
  expect(duplicate.status).toBe(409);
});

test('verificación de uso único, vencimiento y reenvío limitado', async () => {
  const user = await register('verify@example.com');
  const resend = await request(app).post('/api/v1/commercial/verification').set('Authorization', `Bearer ${user.accessToken}`);
  expect(resend.status).toBe(429);
  const raw = await verifyUser(user);
  expect((await request(app).post('/api/v1/commercial/verify').send({ token: raw })).status).toBe(400);
  const expired = 'a'.repeat(64);
  await Token.create({ hash: hash(expired), kind: 'verify', userId: user.user._id, expiresAt: new Date(Date.now() - 1000) });
  expect((await request(app).post('/api/v1/commercial/verify').send({ token: expired })).status).toBe(400);
});

test('reset de contraseña consume token atómicamente incluso con dos solicitudes', async () => {
  const user = await register('reset@example.com');
  const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: user.user.email });
  const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/auth/reset-password').send({ token: forgot.body.data.resetToken, newPassword: 'NewPassword123' })));
  expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  const login = await request(app).post('/api/v1/auth/login').send({ email: user.user.email, password: 'NewPassword123' });
  expect(login.status).toBe(200);
  expect((await request(app).get('/api/v1/commercial/subscription').set('Authorization', `Bearer ${user.accessToken}`)).status).toBe(401);
});

test('configuración incompleta y modo simulado bloquean checkout', () => {
  const previous = process.env.COMMERCIAL_AMOUNT_MINOR;
  delete process.env.COMMERCIAL_AMOUNT_MINOR;
  expect(() => checkoutConfig()).toThrow();
  process.env.COMMERCIAL_AMOUNT_MINOR = previous;
  process.env.COMMERCIAL_MODE = 'mock';
  expect(() => checkoutConfig()).toThrow();
  process.env.COMMERCIAL_MODE = 'test';
});

test('webhook verifica firma, cuerpo original y modo', () => {
  const raw = Buffer.from(JSON.stringify({ id: 'evt_fixture', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_fixture' } } }));
  const time = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', 'whsec_fixture').update(`${time}.`).update(raw).digest('hex');
  expect(provider.verifyWebhook(raw, `t=${time},v1=${signature}`).id).toBe('evt_fixture');
  expect(() => provider.verifyWebhook(Buffer.concat([raw, Buffer.from(' ')]), `t=${time},v1=${signature}`)).toThrow();
  expect(() => provider.verifyWebhook(raw, `t=${time - 600},v1=${signature}`)).toThrow();
});

test('activación concurrente genera una empresa y eventos duplicados no duplican', async () => {
  const user = await register('activate@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session } = snapshot(contract);
  await Contract.updateOne({ _id: contract._id }, { $set: { sessionId: session.id } });
  const before = await Company.countDocuments();
  await Promise.all([service.reconcile(contract.id), service.reconcile(contract.id)]);
  expect(await Company.countDocuments()).toBe(before + 1);
  const activated = await Contract.findById(contract.id);
  expect(activated.status).toBe('active');
  expect(String((await User.findById(user.user._id)).companyId)).toBe(String(activated.companyId));
  const event = { id: 'evt_duplicate', type: 'checkout.session.completed', data: { object: { id: session.id } } };
  await service.webhook(event);
  expect((await service.webhook(event)).duplicate).toBe(true);
  expect(await Company.countDocuments()).toBe(before + 1);
  const other = await Company.create({ name: 'Otra empresa' });
  expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${user.accessToken}`)).status).toBe(401);
  user.accessToken = (await require('../src/modules/auth/auth.service').refresh(user.refreshToken)).accessToken;
  const cross = await request(app).get(`/api/v1/companies/${other.id}`).set('Authorization', `Bearer ${user.accessToken}`);
  expect(cross.status).toBe(403);
  // Old-context tokens are rejected; refreshed tokens use the activated company.
  expect((await request(app).get('/api/v1/companies').set('Authorization', `Bearer ${user.accessToken}`)).body.data).toHaveLength(1);
  expect((await request(app).post('/api/v1/users').set('Authorization', `Bearer ${user.accessToken}`).send({ name: 'Hacker', email: 'hacker@example.com', password, role: 'SUPER_ADMIN' })).status).toBe(403);
  await service.setup(user.user._id, { branchName: 'Principal' });
  await service.setup(user.user._id, { branchName: 'Duplicada' });
  expect(await require('../src/modules/branches/branch.model').countDocuments({ companyId: activated.companyId })).toBe(1);
});

test('error de proveedor permite reintentar sin empresa parcial', async () => {
  const user = await register('retry@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session } = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id } });
  provider.stripe.mockRejectedValueOnce(new Error('Temporary provider failure'));
  await expect(service.reconcile(contract.id)).rejects.toThrow();
  expect((await Contract.findById(contract.id)).companyId).toBeUndefined();
  await service.reconcile(contract.id);
  expect((await Contract.findById(contract.id)).status).toBe('active');
});

test('importe incorrecto y pago pendiente no activan', async () => {
  const user = await register('unpaid@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session } = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id } });
  session.amount_total = 1;
  await expect(service.reconcile(contract.id)).rejects.toThrow();
  session.amount_total = 10000; session.status = 'open';
  await service.reconcile(contract.id);
  expect((await Contract.findById(contract.id)).companyId).toBeUndefined();
});

test('eventos fuera de orden consultan estado actual; vencimiento bloquea acceso directo', async () => {
  const user = await register('expired@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session, subscription } = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id } });
  await service.reconcile(contract.id);
  subscription.status = 'canceled';
  await service.webhook({ id: 'evt_old_active', type: 'customer.subscription.updated', data: { object: { id: session.subscription, status: 'active' } } });
  expect((await Contract.findById(contract.id)).status).toBe('canceled');
  user.accessToken = (await require('../src/modules/auth/auth.service').refresh(user.refreshToken)).accessToken;
  await Contract.updateOne({ _id: contract.id }, { $set: { status: 'active', periodEnd: new Date(Date.now() - 1000) } });
  const denied = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${user.accessToken}`);
  expect(denied.status).toBe(403); expect(denied.body.code).toBe('SUBSCRIPTION_REQUIRED');
});

test('invitaciones concurrentes respetan último cupo y no aceptan otro correo', async () => {
  const owner = await register('owner@example.com'); await verifyUser(owner);
  const contract = await Contract.findOne({ ownerId: owner.user._id });
  const { session } = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id, 'plan.maxUsers': 2 } });
  await service.reconcile(contract.id);
  const guests = await Promise.all(['guest1@example.com', 'guest2@example.com'].map(register));
  for (const guest of guests) { await verifyUser(guest); await service.invite(owner.user._id, guest.user.email); }
  const links = await Promise.all(guests.map(guest => Mail.findOne({ to: guest.user.email, subject: 'Invitación al ERP' }).select('+text')));
  const tokens = links.map(mail => mail.text.split('token=')[1]);
  await expect(service.acceptInvite(guests[0].user._id, tokens[1])).rejects.toThrow();
  const results = await Promise.allSettled(guests.map((guest, index) => service.acceptInvite(guest.user._id, tokens[index])));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await Contract.findById(contract.id)).seats).toBe(2);
  expect(await User.countDocuments({ companyId: (await Contract.findById(contract.id)).companyId })).toBe(2);
  const acceptedGuest = await User.findOne({ companyId: (await Contract.findById(contract.id)).companyId, role: 'VENTAS' });
  expect((await service.subscriptionView(acceptedGuest.id)).isOwner).toBe(false);
  expect((await service.subscriptionView(acceptedGuest.id)).status).toBe('active');
});

test('cuenta existente contrata segunda empresa y cambia solo a membresías propias', async () => {
  const user = await register('multiple@example.com'); await verifyUser(user);
  const first = await Contract.findOne({ ownerId: user.user._id });
  let remote = snapshot(first);
  await Contract.updateOne({ _id: first.id }, { $set: { sessionId: remote.session.id } });
  await service.reconcile(first.id);
  const firstCompany = (await Contract.findById(first.id)).companyId;
  const data = { companyName: 'Segunda Empresa', acceptTerms: true, termsVersion: 'draft-2026-10-05' };
  const second = await service.newContract(user.user._id, data);
  expect((await service.newContract(user.user._id, data)).id).toBe(second.id);
  jest.restoreAllMocks(); remote = snapshot(second);
  await Contract.updateOne({ _id: second.id }, { $set: { sessionId: remote.session.id } });
  await service.reconcile(second.id);
  expect(await Membership.countDocuments({ userId: user.user._id })).toBe(2);
  expect(await Contract.countDocuments({ ownerId: user.user._id, status: 'active' })).toBe(2);
  await service.switchCompany(user.user._id, firstCompany);
  expect(String((await User.findById(user.user._id)).companyId)).toBe(String(firstCompany));
  const other = await Company.create({ name: 'Ajena' });
  await expect(service.switchCompany(user.user._id, other.id)).rejects.toThrow();
});

test('checkout usa precio de servidor y recupera sesión abierta; discrepancia impide cobro', async () => {
  const user = await register('checkout@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const spy = jest.spyOn(provider, 'stripe').mockImplementation(async (path, params) => {
    if (path.startsWith('prices/')) return { active: true, unit_amount: 10000, currency: 'mxn', recurring: { interval: 'month', interval_count: 1 } };
    if (path === 'checkout/sessions') {
      expect(params['line_items[0][price]']).toBe('price_fixture');
      return { id: `cs_checkout_${contract.id}`, url: 'https://checkout.stripe.com/test' };
    }
    return { status: 'open', url: 'https://checkout.stripe.com/test' };
  });
  expect((await service.checkout(user.user._id)).url).toBe('https://checkout.stripe.com/test');
  await service.checkout(user.user._id);
  expect(spy.mock.calls.filter(([path]) => path === 'checkout/sessions')).toHaveLength(1);
  spy.mockImplementation(async () => ({ active: true, unit_amount: 1, currency: 'mxn', recurring: { interval: 'month', interval_count: 1 } }));
  await expect(service.checkout(user.user._id)).rejects.toThrow();
});

test('fallo dentro de activación revierte empresa, membresía y cuenta y permite recuperación', async () => {
  const user = await register('rollback@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const remote = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: remote.session.id } });
  const count = await Company.countDocuments();
  const create = jest.spyOn(Membership, 'create').mockRejectedValueOnce(new Error('Injected database interruption'));
  await expect(service.reconcile(contract.id)).rejects.toThrow();
  expect(await Company.countDocuments()).toBe(count);
  expect((await User.findById(user.user._id)).companyId).toBeUndefined();
  create.mockRestore(); await service.reconcile(contract.id);
  expect(await Company.countDocuments()).toBe(count + 1);
});

test('renovación recupera acceso; cancelación conserva periodo pagado; reembolso restringe', async () => {
  const user = await register('renew@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session, subscription } = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id } });
  await service.reconcile(contract.id);
  await Contract.updateOne({ _id: contract.id }, { $set: { status: 'restricted' } });
  await service.reconcile(contract.id);
  expect((await Contract.findById(contract.id)).status).toBe('active');
  const implementation = provider.stripe.getMockImplementation();
  provider.stripe.mockImplementation(async (path, params, method) => {
    if (path.startsWith('subscriptions/') && method === 'POST') subscription.cancel_at_period_end = params.cancel_at_period_end === 'true';
    return implementation(path, params, method);
  });
  await service.cancel(user.user._id);
  const canceled = await Contract.findById(contract.id);
  expect(canceled.cancelAtPeriodEnd).toBe(true);
  expect(canceled.status).toBe('active');
  await service.webhook({ id: 'evt_refund_fixture', type: 'charge.refunded', data: { object: { invoice: `in_${contract.id}` } } });
  await service.reconcile(contract.id);
  expect((await Contract.findById(contract.id)).status).toBe('restricted');
  expect((await Payment.findOne({ contractId: contract.id })).status).toBe('refunded');
});

test('webhook HTTP preserva cuerpo original; firma falsa se rechaza', async () => {
  const event = { id: 'evt_http_fixture', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'unknown_session' } } };
  const raw = JSON.stringify(event); const time = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', 'whsec_fixture').update(`${time}.${raw}`).digest('hex');
  const accepted = await request(app).post('/api/v1/commercial/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', `t=${time},v1=${signature}`).send(raw);
  expect(accepted.status).toBe(200);
  expect((await request(app).post('/api/v1/commercial/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', `t=${time},v1=${'0'.repeat(64)}`).send(raw)).status).toBe(400);
});

test('pago rechazado y checkout abandonado no crean empresa', async () => {
  const user = await register('rejected@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session } = snapshot(contract, { status: 'incomplete' });
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id } });
  await service.reconcile(contract.id);
  expect((await Contract.findById(contract.id)).companyId).toBeUndefined();
  session.status = 'expired'; await service.reconcile(contract.id);
  expect((await Contract.findById(contract.id)).status).toBe('expired');
});

test('factura antes del evento de checkout recupera activación y fallo notifica una vez', async () => {
  const user = await register('invoice-first@example.com'); await verifyUser(user);
  const contract = await Contract.findOne({ ownerId: user.user._id });
  const { session } = snapshot(contract);
  await Contract.updateOne({ _id: contract.id }, { $set: { sessionId: session.id } });
  await service.webhook({ id: 'evt_invoice_first', type: 'invoice.paid', data: { object: { subscription: session.subscription } } });
  expect((await Contract.findById(contract.id)).status).toBe('active');
  const failed = { id: 'evt_payment_failed', type: 'invoice.payment_failed', data: { object: { subscription: session.subscription } } };
  await service.webhook(failed); await service.webhook(failed);
  expect(await Mail.countDocuments({ notificationId: 'evt_payment_failed-payment-failed' })).toBe(1);
});

test('rotación concurrente de refresh permite un solo consumo y contraseña no se trunca', async () => {
  const user = await register('refresh-race@example.com');
  const responses = await Promise.all([1, 2].map(() => request(app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken })));
  expect(responses.map(result => result.status).sort()).toEqual([200, 401]);
  const tooLong = await request(app).post('/api/v1/auth/register').send({ name: 'Prueba', email: 'long-password@example.com',
    password: 'ñ'.repeat(40), confirmPassword: 'ñ'.repeat(40), companyName: 'Empresa', acceptTerms: true, termsVersion: 'draft-2026-10-05' });
  expect(tooLong.status).toBe(400);
});
