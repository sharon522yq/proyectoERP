const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
function compile(relative, context) {
  const filename = require.resolve(relative);
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
  vm.runInNewContext(code, context);
  return context.exports;
}
test('invoice-only role can enter Sales and fetches invoices without requesting quotes', async () => {
  const effects = [], states = [], calls = [];
  const has = permission => permission === 'sales.invoices.read';
  const react = { createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => { const value = typeof initial === 'function' ? initial() : initial; states.push(value); return [value, () => {}]; },
    useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) };
  const exports = compile('../src/screens/sales/SalesScreen', { exports: {}, require: name => {
    if (name === 'react') return react;
    if (name === 'react-native') return { StyleSheet: { create: value => value }, Platform: { OS: 'web' } };
    if (name.includes('AuthContext')) return { useAuth: () => ({ has }) };
    if (name.includes('theme/tokens')) return { tokens: { colors: {}, spacing: {}, typography: { sizes: {} }, borderRadius: {} } };
    if (name.includes('services/api')) return { salesApi: Object.fromEntries(['Quotes', 'Orders', 'Invoices'].map(key => ['get' + key, async () => { calls.push(key); return { items: [] }; }])), crmApi: {}, productsApi: {}, inventoryApi: {} };
    if (name.includes('NavigationBack')) return { useBackAction() {} };
    return {};
  } });
  exports.default({}); effects.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(states[0], 'invoices'); assert.deepEqual(calls, ['Invoices']);
  const config = compile('../src/constants/config', { exports: {}, process: { env: {} } });
  assert.equal(config.canOpenMenu(config.MENU_BY_PERMISSION.find(item => item.route === 'sales'), has), true);
  assert.equal(config.canOpenMenu(config.MENU_BY_PERMISSION.find(item => item.route === 'sales'), () => false), false);
});
