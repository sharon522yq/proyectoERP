const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const babel = require('@babel/core');
const filename = require.resolve('../src/screens/crm/CrmScreen.js');
const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
test('CRM renders existing leads and an accessible conversion action', () => {
  let state = 0;
  const native = { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Button: 'Button', Modal: 'Modal', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: v => v } };
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useEffect: () => {}, useRef: () => ({ current: null }),
    useState: initial => [state++ === 0 ? [{ _id: 'lead1', name: 'Synthetic Lead', status: 'NEW' }] : state === 2 ? false : initial, () => {}]
  };
  const context = { exports: {}, require: name => {
    if (name.includes('context/AuthContext')) return { useAuth: () => ({ has: () => true }) };
    if (name === 'react') return react;
    if ((name === 'react-native' || name.endsWith('/design/ui'))) return native;
    if (name.includes('theme/tokens')) return { tokens: { colors: {}, typography: { sizes: {} }, spacing: {}, shadows: {}, borderRadius: {} } };
    return {};
  } };
  vm.runInNewContext(code, context);
  const tree = context.exports.default({});
  let action;
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Button' && node.props?.title === 'Convertir a Cliente') action = node;
    visit(node.children);
  }
  visit(tree);
  assert.ok(action);
  assert.equal(typeof action.props.onPress, 'function');
});
