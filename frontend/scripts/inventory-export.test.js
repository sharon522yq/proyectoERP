const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const file = require.resolve('../src/services/saveInventoryExcel.js');
const code = babel.transformSync(fs.readFileSync(file, 'utf8'), { filename: file, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
const context = { exports: {}, Uint8Array }; vm.runInNewContext(code, context);
const save = context.exports.saveInventoryExcel;
const data = { filename: 'Inventario_Nexus.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: Buffer.from([80, 75, 3, 4]).toString('base64') };
test('web downloads exact bytes, uses server filename and revokes the temporary URL', async () => {
  let clicked = false, removed = false, revoked, blob, scheduled;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  await save(data, 'web', { document: { createElement: () => link, body: { appendChild: () => {} } }, atob: s => Buffer.from(s, 'base64').toString('binary'), Blob: class { constructor(parts, options) { blob = { parts, options }; } }, URL: { createObjectURL: () => 'blob:export', revokeObjectURL: v => { revoked = v; } }, setTimeout: fn => { scheduled = fn; } });
  assert.equal(clicked, true); assert.equal(removed, true); assert.equal(link.download, data.filename); assert.deepEqual(Array.from(blob.parts[0]), [80, 75, 3, 4]); assert.equal(blob.options.type, data.mimeType); scheduled(); assert.equal(revoked, 'blob:export');
});
test('Android writes base64 as binary and shares a private cache file with Excel MIME', async () => {
  let written, shared;
  class File { constructor(path, name) { this.uri = path + '/' + name; } create(options) { assert.equal(options.overwrite, true); } write(value, options) { written = { value, options }; } }
  await save(data, 'android', { filesystem: { File, Paths: { cache: 'file:///private/cache' } }, sharing: { isAvailableAsync: async () => true, shareAsync: async (uri, options) => { shared = { uri, options }; } } });
  assert.equal(written.value, data.base64); assert.equal(written.options.encoding, 'base64'); assert.equal(shared.uri, 'file:///private/cache/' + data.filename); assert.equal(shared.options.mimeType, data.mimeType);
});
test('unavailable Android sharing and malformed filenames report actionable failures', async () => {
  await assert.rejects(save(data, 'android', { sharing: { isAvailableAsync: async () => false } }), /navegador/);
  await assert.rejects(save({ ...data, filename: '../secret.xlsx' }, 'web'), /válido/);
});

const componentFile = require.resolve('../src/components/InventoryExportButton.js');
const componentCode = babel.transformSync(fs.readFileSync(componentFile, 'utf8'), { filename: componentFile, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
function harness(permissions, api) {
  let index = 0; const slots = [];
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), useState: initial => { const n = index++; if (!(n in slots)) slots[n] = initial; return [slots[n], v => slots[n] = v]; }, useRef: initial => { const n = index++; if (!(n in slots)) slots[n] = { current: initial }; return slots[n]; } };
  const env = { exports: {}, require: name => name === 'react' ? react : (name === 'react-native' || name.endsWith('/design/ui')) ? { View: 'View', Text: 'Text', TouchableOpacity: 'Button', Platform: { OS: 'web' } } : name.includes('theme/tokens') ? {tokens:{colors:{primary:'purple',error:'red',success:'green'}}} : name.includes('AuthContext') ? { useAuth: () => ({ has: p => permissions.includes(p) }) } : name.includes('saveInventoryExcel') ? { saveInventoryExcel: async () => 'Descarga iniciada' } : { inventoryApi: { exportExcel: api } } };
  vm.runInNewContext(componentCode, env);
  const render = () => { index = 0; return env.exports.default({}); };
  function nodes(tree) { return !tree ? [] : [tree, ...(tree.children || []).flat(Infinity).filter(n => n && typeof n === 'object').flatMap(nodes)]; }
  return { render, slots, button: () => nodes(render()).find(n => n.type === 'Button') };
}
test('button requires both permissions and blocks concurrent clicks until download finishes', async () => {
  assert.equal(harness(['inventory.read'], () => {}).render(), null);
  let calls = 0, resolve; const pending = new Promise(r => resolve = r);
  const h = harness(['inventory.read', 'products.read'], () => { calls++; return pending; });
  const action = h.button().props.onPress; const first = action(); await action(); assert.equal(calls, 1); assert.equal(h.button().props.disabled, true);
  resolve(data); await first; assert.equal(h.button().props.disabled, false); assert.equal(h.slots[2], 'Descarga iniciada');
});
test('button displays server failure without claiming successful download', async () => {
  const h = harness(['inventory.read', 'products.read'], async () => { throw { response: { data: { message: 'Espera un minuto' } } }; });
  await h.button().props.onPress(); assert.equal(h.slots[1], 'Espera un minuto'); assert.equal(h.slots[2], ''); assert.equal(h.button().props.disabled, false);
});
