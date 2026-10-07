const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const file = require.resolve('../src/screens/sales/invoiceDocument.js');
const code = babel.transformSync(fs.readFileSync(file, 'utf8'), { filename: file, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
const context = { exports: {} };
vm.runInNewContext(code, context);
const invoice = { folio: 'FAC-000001', issuerName: 'Nexus', customerName: '<script>alert(1)</script>', createdAt: '2026-10-06', currency: 'MXN', items: [{ description: 'Producto & servicio', quantity: 2, unitPrice: 100 }], subtotal: 200, taxTotal: 32, total: 232 };
test('internal invoice contains issuer, customer, lines and totals without claiming fiscal validity', () => {
  const text = context.exports.invoiceText(invoice, 'Fallback');
  assert.match(text, /Nexus/);
  assert.match(text, /2 × 100.00 MXN/);
  assert.match(text, /Total: 232.00 MXN/);
  assert.match(text, /No es un comprobante fiscal/);
});
test('print document escapes stored customer and product content', () => {
  const html = context.exports.invoiceHtml(invoice, 'Fallback');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Producto &amp; servicio/);
});
