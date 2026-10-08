const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const filename = require.resolve('../src/services/formatProductPrice.js');
const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
const context = { exports: {}, Intl };
vm.runInNewContext(code, context);
const { formatProductPrice } = context.exports;
test('catalog formats valid and default currencies', () => {
  assert.match(formatProductPrice(330, 'mxn'), /330\.00.*MXN/);
  assert.match(formatProductPrice(330), /330\.00.*MXN/);
});
test('legacy invalid currency labels never crash the product catalog', () => {
  for (const currency of ['$', 'US', '123', ' MX ', '']) {
    assert.doesNotThrow(() => formatProductPrice(330, currency));
    assert.match(formatProductPrice(330, currency), /330\.00/);
  }
  assert.equal(formatProductPrice('invalid', 'MXN'), '—');
});
