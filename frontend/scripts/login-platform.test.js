const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');

const filename = require.resolve('../src/screens/LoginScreen.js');
const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename, babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx']
}).code;

function renderLogin(platform, windowValue) {
  const states = [];
  const effects = [], backSubscriptions = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => { states.push(initial); return [initial, () => {}]; },
    useRef: () => ({ current: null }), useEffect: fn => effects.push(fn)
  };
  const context = {
    exports: {}, window: windowValue,
    require: name => {
      if (name === 'react') return react;
      if ((name === 'react-native' || name.endsWith('/design/ui'))) return {
        Platform: { OS: platform }, useWindowDimensions: () => ({ width: 390 }), BackHandler: { addEventListener: () => { backSubscriptions.push(platform); return { remove() {} }; } }, StyleSheet: { create: value => value }
      };
      if (name.includes('AuthContext')) return { useAuth: () => ({}) };
      if (name.includes('theme/tokens')) return { tokens: {
        colors: {}, spacing: {}, typography: { sizes: {} }, borderRadius: {}, shadows: {}
      } };
      return {};
    }
  };
  // Android has a window global, but no browser location or URLSearchParams.
  if (platform === 'web') context.URLSearchParams = URLSearchParams;
  vm.runInNewContext(code, context);
  const tree = context.exports.default();
  effects.forEach(fn => fn());
  return { tree, states, backSubscriptions };
}

test('Android login renders when window exists without browser APIs', () => {
  const result = renderLogin('android', {});
  assert.ok(result.tree);
  assert.equal(result.states[0], 'login');
  assert.equal(result.states[2], '');
  assert.equal(result.backSubscriptions.length, 1);
});
test('iOS login renders without a browser window', () => {
  assert.equal(renderLogin('ios', undefined).states[0], 'login');
});
test('web recovery links still initialize the reset form', () => {
  const result = renderLogin('web', { location: { search: '?resetToken=example-recovery-code' } });
  assert.equal(result.states[0], 'reset');
  assert.equal(result.states[2], 'example-recovery-code');
});
test('web login without recovery token remains available', () => {
  const result = renderLogin('web', { location: { search: '' } });
  assert.equal(result.states[0], 'login');
  assert.equal(result.backSubscriptions.length, 0);
});
