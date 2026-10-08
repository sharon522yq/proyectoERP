const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyWebExport } = require('./verify-web-export');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-cloudflare-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['public','dist/_expo/static/js/web','src/constants']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<html></html>');
  fs.writeFileSync(path.join(root, 'dist/_headers'), '/*\n  X-Content-Type-Options: nosniff');
  fs.writeFileSync(path.join(root, 'wrangler.jsonc'), JSON.stringify({ assets: { not_found_handling: 'single-page-application' }, previews: {}, build: { command: 'npm run export:web && npm run verify:web' } }));
  fs.writeFileSync(path.join(root, 'dist/_expo/static/js/web/app.js'), 'https://proyectoerp-api.onrender.com/api/v1');
  fs.writeFileSync(path.join(root, 'src/constants/config.js'), '');
  return root;
}
test('valid Workers SPA export passes without Pages redirects', t => {
  assert.doesNotThrow(() => verifyWebExport(fixture(t)));
});
for (const file of ['public/_redirects','dist/_redirects']) test('rejects loop-causing redirect file in ' + file, t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, file), '/* /index.html 200');
  assert.throws(() => verifyWebExport(root), /Legacy SPA redirects conflict/);
});
test('rejects an export without the native SPA routing fallback', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'wrangler.jsonc'), JSON.stringify({ assets: {} }));
  assert.throws(() => verifyWebExport(root), /Cloudflare SPA routing is required/);
});

for (const [key, message] of [['previews', /previews configuration is required/], ['build', /must build and verify fresh web assets/]]) test('rejects deployment configuration missing ' + key, t => {
  const root = fixture(t);
  const file = path.join(root, 'wrangler.jsonc');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete config[key];
  fs.writeFileSync(file, JSON.stringify(config));
  assert.throws(() => verifyWebExport(root), message);
});
