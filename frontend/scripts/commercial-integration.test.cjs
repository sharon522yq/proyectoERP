const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
function render(platform, initialRoute) {
  let index = 0;
  const states = [];
  const react = { createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => { const value = index++ === 1 ? { checkoutEnabled: false, amount: null, currency: 'mxn' } : typeof initial === 'function' ? initial() : initial; states.push(value); return [value, () => {}]; },
    useEffect() {}, useRef: value => ({ current: value }) };
  const filename = require.resolve('../src/screens/CommercialScreen');
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
  const context = { exports: {}, window: platform === 'web' ? { location: { hash: '#' + initialRoute } } : {}, URLSearchParams,
    require: name => {
      if (name === 'react') return react;
      if (name === 'react-native') return { Platform: { OS: platform }, StyleSheet: { create: value => value } };
      if (name.includes('AuthContext')) return { useAuth: () => ({ user: null }) };
      return {};
    } };
  vm.runInNewContext(code, context);
  return { tree: context.exports.default({ initialRoute }), states };
}
function text(node) { return Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.children) : typeof node === 'string' ? node : ''; }
test('disabled commercial home explains availability and hides checkout actions', () => {
  const content = text(render('web', 'home').tree);
  assert.match(content, /contratación de empresas nuevas está deshabilitada/);
  assert.doesNotMatch(content, /Elegir el plan|Contratar otra empresa/);
});
test('direct registration route cannot expose a form while checkout is disabled', () => {
  const content = text(render('web', 'register').tree);
  assert.doesNotMatch(content, /Crea tu cuenta|Registrar y verificar/);
  assert.match(content, /deshabilitada/);
});
test('Android commercial screens work with a window global without browser location', () => {
  assert.ok(render('android', 'subscription').tree);
});
