const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { loginRequest, isSessionRequest } = require('../src/services/authTransport');

test('login admite espera de arranque y valida la respuesta antes de iniciar sesión', async () => {
  let requests = 0;
  const client = axios.create({ adapter: async config => {
    requests++;
    assert.equal(config.timeout, 90000);
    assert.equal(config.url, '/auth/login');
    assert.deepEqual(JSON.parse(config.data), { email: 'qa@example.invalid', password: 'synthetic' });
    return { data: { success: true, data: { accessToken: 'qa-access', refreshToken: 'qa-refresh', user: { name: 'QA' } } }, status: 200, config };
  } });
  const result = await loginRequest(client, 'qa@example.invalid', 'synthetic');
  assert.equal(result.user.name, 'QA');
  assert.equal(requests, 1);
});
test('un timeout no reenvía las credenciales automáticamente', async () => {
  let requests = 0;
  const client = axios.create({ adapter: async () => {
    requests++; throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
  } });
  await assert.rejects(loginRequest(client, 'qa@example.invalid', 'synthetic'), { code: 'ECONNABORTED' });
  assert.equal(requests, 1);
});
test('respuesta HTTP 200 incompleta nunca se considera login exitoso', async () => {
  const client = axios.create({ adapter: async config => ({ data: { success: true, data: { user: {} } }, status: 200, config }) });
  await assert.rejects(loginRequest(client, 'qa@example.invalid', 'synthetic'), error => error.response.status === 502);
});
test('sesión restaurada puede refrescarse sin tratar credenciales inválidas como sesión vencida', () => {
  assert.equal(isSessionRequest('/auth/me'), true);
  assert.equal(isSessionRequest('/inventory/stock'), true);
  for (const path of ['/auth/login', '/auth/register', '/auth/refresh', '/auth/reset-password']) assert.equal(isSessionRequest(path), false);
});
