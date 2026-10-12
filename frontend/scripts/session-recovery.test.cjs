const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');

function transport(refresh) {
  const storage = new Map([['erp_access_token', 'old-access'], ['erp_refresh_token', 'old-refresh']]);
  let rejectResponse, invalidations = 0, requests = 0;
  const api = config => { requests++; return Promise.resolve(config); };
  api.interceptors = { request: { use() {} }, response: { use: (_, reject) => { rejectResponse = reject; } } };
  const filename = require.resolve('../src/services/api');
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code;
  const context = { exports: {}, window: { localStorage: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
  } }, require: name => {
    if (name === 'axios') return { create: () => api, post: refresh };
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name.includes('constants/config')) return { API_URL: 'https://test.invalid/api/v1' };
    return require('../src/services/authTransport');
  } };
  vm.runInNewContext(code, context);
  context.exports.setOnUnauthorized(() => invalidations++);
  return { storage, reject: rejectResponse, get invalidations() { return invalidations; }, get requests() { return requests; } };
}
const expired = () => ({ response: { status: 401 }, config: { url: '/auth/me', headers: {} } });

test('a transient refresh failure preserves stored session and permits retry', async () => {
  let count = 0;
  const fixture = transport(async () => {
    if (++count === 1) throw Object.assign(new Error('offline'), { code: 'ERR_NETWORK' });
    return { data: { data: { accessToken: 'new-access', refreshToken: 'new-refresh' } } };
  });
  await assert.rejects(fixture.reject(expired()), /offline/);
  assert.equal(fixture.storage.get('erp_refresh_token'), 'old-refresh');
  assert.equal(fixture.invalidations, 0);
  await fixture.reject(expired());
  assert.equal(fixture.storage.get('erp_access_token'), 'new-access');
  assert.equal(fixture.requests, 1);
});
test('malformed refresh never erases an otherwise recoverable session', async () => {
  const fixture = transport(async () => ({ data: { data: {} } }));
  await assert.rejects(fixture.reject(expired()), /incompleta/);
  assert.equal(fixture.storage.get('erp_access_token'), 'old-access');
  assert.equal(fixture.invalidations, 0);
});
test('revoked refresh removes tokens, while invalid login does not invalidate a session', async () => {
  const fixture = transport(async () => { throw { response: { status: 401 } }; });
  await assert.rejects(fixture.reject({ response: { status: 401 }, config: { url: '/auth/login' } }));
  assert.equal(fixture.invalidations, 0);
  await assert.rejects(fixture.reject(expired()));
  assert.equal(fixture.storage.has('erp_refresh_token'), false);
  assert.ok(fixture.invalidations > 0);
});
