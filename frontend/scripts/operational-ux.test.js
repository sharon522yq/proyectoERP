const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
function compile(file, react) {
  const filename = require.resolve(file);
  const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] }).code;
  const ctx = { exports: {}, require: name => name === 'react' ? react : name === 'react-native' ? { View: 'View', Text: 'Text', TextInput: 'TextInput', Modal: 'Modal', ScrollView: 'ScrollView', Pressable: 'Pressable', Button: 'Button', StyleSheet: { create: value => value } } : { tokens: { colors: {} } } };
  vm.runInNewContext(code, ctx); return ctx.exports;
}
function nodes(tree) {
  const result = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; result.push(node); visit(node.children); }
  visit(tree); return result;
}
test('search selection filters names and closes after choosing; dismissing does not change the selection', () => {
  const values = []; let cursor = 0;
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), useState: initial => { const key = cursor++; if (!(key in values)) values[key] = initial; return [values[key], next => values[key] = next]; } };
  const component = compile('../src/components/SearchSelect.js', react).default;
  const chosen = [], props = { label: 'Cliente', items: [{ _id: 'a', name: 'Alpha' }, { _id: 'b', name: 'Beta' }], value: '', onChange: value => chosen.push(value) };
  const render = () => { cursor = 0; return nodes(component(props)); };
  render().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Seleccionar').props.onPress();
  render().find(node => node.type === 'TextInput').props.onChangeText('alp');
  const filtered = render();
  assert.ok(filtered.find(node => node.props?.accessibilityLabel === 'Alpha'));
  assert.equal(filtered.some(node => node.props?.accessibilityLabel === 'Beta'), false);
  filtered.find(node => node.props?.accessibilityLabel === 'Alpha').props.onPress();
  assert.deepEqual(chosen, ['a']); assert.equal(render().find(node => node.type === 'Modal').props.visible, false);
  render().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Seleccionar').props.onPress();
  render().find(node => node.type === 'Modal').props.onRequestClose();
  assert.deepEqual(chosen, ['a']);
});
test('record fields reject impossible dates and negative amounts while allowing optional empty fields', () => {
  const { validateRecord } = compile('../src/components/RecordEditor.js', { createElement: () => null });
  const fields = [{ key: 'name', label: 'Nombre', required: true }, { key: 'salary', label: 'Salario', numeric: true }, { key: 'date', label: 'Fecha', date: true }];
  assert.equal(validateRecord(fields, { name: 'Persona', salary: '0', date: '' }), '');
  assert.match(validateRecord(fields, { name: 'Persona', salary: '-1' }), /Salario/);
  assert.match(validateRecord(fields, { name: 'Persona', date: '2026-02-31' }), /fecha válida/);
  assert.equal(validateRecord(fields, { name: 'Persona', date: '2026-10-07' }), '');
});
