const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/configure-render-cors.js'), 'utf8');
async function run(responses) {
  const calls = [], logs = [];
  const context = {
    process: { env: { RENDER_API_KEY: 'test-key' } }, AbortSignal, encodeURIComponent,
    console: { log: value => logs.push(value), error: value => logs.push(value) },
    fetch: async (url, options) => {
      calls.push({ url, method: options.method, body: options.body });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return { ok: true, status: 200, json: async () => next };
    }
  };
  await vm.runInNewContext(source, context);
  return { calls, logs, process: context.process };
}
const target = [{ service: { id: 'srv-example', name: 'proyectoerp-api', serviceDetails: { url: 'https://proyectoerp-api.onrender.com' } } }];
test('updates a single CORS variable preserving authorized origins and requests deployment', async () => {
  const result = await run([target, { value: 'https://erp.example.com,https://admin.example.com/' }, {}, { id: 'dep-example', status: 'created' }]);
  const update = result.calls.find(call => call.method === 'PUT');
  expect(update.url).toBe('https://api.render.com/v1/services/srv-example/env-vars/CORS_ORIGINS');
  expect(JSON.parse(update.body)).toEqual({ value: 'https://erp.example.com,https://admin.example.com,http://localhost:8086' });
  expect(JSON.parse(result.calls.at(-1).body)).toEqual({ deployMode: 'deploy_only' });
  expect(result.process.env.RENDER_API_KEY).toBeUndefined();
  expect(result.logs.join('')).not.toContain('test-key');
});
test('rejects an unverified service without modifying configuration', async () => {
  const result = await run([[{ service: { id: 'wrong', name: 'proyectoerp-api', serviceDetails: { url: 'https://other.onrender.com' } } }]]);
  expect(result.calls).toHaveLength(1);
  expect(result.logs).toEqual(['RENDER_DESTINATION_AMBIGUOUS']);
  expect(result.process.exitCode).toBe(1);
});
test('is idempotent when the origin is already configured', async () => {
  const result = await run([target, { value: 'http://localhost:8086' }]);
  expect(result.calls).toHaveLength(2);
  expect(JSON.parse(result.logs[0]).changed).toBe(false);
});
test('does not print remote errors containing secrets', async () => {
  const result = await run([new Error('remote test-key private URI')]);
  expect(result.logs).toEqual(['RENDER_CORS_UPDATE_FAILED']);
});
