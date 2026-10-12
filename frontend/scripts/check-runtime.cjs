const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const reactVersion = require('react/package.json').version;
const expected = require('../package.json').dependencies;
assert.equal(reactVersion, expected.react, 'React instalado no coincide con package.json');
assert.equal(require('react-dom/package.json').version, reactVersion, 'React y React DOM deben coincidir');
assert.equal(require('react-native/package.json').version, expected['react-native'], 'React Native instalado no coincide con Expo');
for (const dependency of ['expo', '@expo/metro-runtime', 'react-native-web', 'react-dom', 'react-native']) {
  const dependencyRequire = createRequire(require.resolve(`${dependency}/package.json`));
  assert.equal(dependencyRequire('react/package.json').version, reactVersion, `${dependency} resuelve otra versión de React`);
}
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { View, Text } = require('react-native-web');
const markup = renderToStaticMarkup(React.createElement(View, null, React.createElement(Text, null, 'Nexus QA')));
assert.ok(markup.includes('Nexus QA'), 'El renderer no renderiza los elementos de React Native Web');
console.log(`Runtime coherente: React/DOM ${reactVersion}, React Native ${expected['react-native']}. Render web aprobado.`);
