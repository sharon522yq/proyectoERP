const fs = require('fs'), vm = require('vm'), path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/audit-render.js'), 'utf8');
async function run(remoteUri) {
  const responses = [[{ service: { id: 'srv-test', name: 'proyectoerp-api', serviceDetails: { url: 'https://proyectoerp-api.onrender.com' } } }], { value: remoteUri }, { value: 'https://erp.example,http://localhost:8086' }, { value: 'https://erp.example' }];
  const logs=[], calls=[];
  const context = { URL, AbortSignal, encodeURIComponent, process: { env: { RENDER_API_KEY: 'private-key', LOCAL_DATABASE_ENV_FILE: 'private-file' } }, console: { log: x => logs.push(x), error: x => logs.push(x) }, require: name => name === 'fs' ? { readFileSync: () => 'MONGODB_URI=mongodb+srv://user:private-password@cluster.example/' } : require(name), fetch: async (url, options) => { calls.push({ url, options }); return { status: 200, ok: true, json: async () => responses.shift() }; } };
  await vm.runInNewContext(source, context);
  return { logs, calls, context };
}
test('compares the selected Mongo destination without revealing credentials or mutating Render', async () => {
  const result = await run('mongodb+srv://user:other-password@cluster.example/test');
  expect(JSON.parse(result.logs[0])).toMatchObject({ mongoConfigured: true, mongoMatchesLocalDestination: true, localhost8086Authorized: true });
  expect(result.calls).toHaveLength(4);
  expect(result.calls.every(call => !call.options.method)).toBe(true);
  expect(result.logs.join('')).not.toMatch(/private-key|private-password|other-password|cluster\.example/);
  expect(result.context.process.env.RENDER_API_KEY).toBeUndefined();
});
test('detects a different production database instead of silently assuming the local destination', async () => {
  const result = await run('mongodb+srv://user:private-password@cluster.example/erp');
  expect(JSON.parse(result.logs[0]).mongoMatchesLocalDestination).toBe(false);
});
