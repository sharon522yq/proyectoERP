const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const filename = require.resolve('../src/screens/finance/FinanceScreen.js');
const code = babel.transformSync(fs.readFileSync(filename,'utf8'), { filename, babelrc:false, configFile:false, plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx'] }).code;
function harness(api) {
  const values=[], effects=[]; let cursor=0;
  const react = {
    createElement:(type,props,...children)=>({type,props,children}),
    useState:initial=>{const key=cursor++;if(!(key in values))values[key]=initial;return[values[key],v=>values[key]=v];},
    useEffect:fn=>effects.push(fn)
  };
  const ctx={exports:{},require:name=>{
    if(name==='react') return react;
    if(name==='react-native') return {View:'View',Text:'Text',ScrollView:'ScrollView',Button:'Button',StyleSheet:{create:v=>v}};
    if(name.includes('services/api')) return {financeApi:api};
    if(name.includes('theme/tokens')) return {tokens:{colors:{},spacing:{},typography:{sizes:{}},shadows:{},borderRadius:{}}};
    return function Component(){};
  }};
  vm.runInNewContext(code,ctx);
  return {values,effects,render:()=>{cursor=0;return ctx.exports.default({});}};
}
test('finance presents the assets field returned by API rather than nonexistent balance',async()=>{
  const h=harness({getSummary:async()=>({assets:123,liabilities:5,netIncome:80}),getTransactions:async()=>[]});
  h.render();h.effects[0]();await new Promise(setImmediate);
  const tree=h.render();const found=[];
  function visit(n){if(Array.isArray(n)){n.forEach(visit);return;}if(n&&typeof n==='object'){if(n.props?.title)found.push(n.props);visit(n.children);}}
  visit(tree);
  assert.equal(found.find(p=>p.title==='Activos').value,'$123');
  assert.equal(found.find(p=>p.title==='Pasivos').value,'$5');
});
test('failed finance requests produce an error instead of fabricated empty balances',async()=>{
  const h=harness({getSummary:async()=>{throw {response:{data:{message:'Synthetic finance failure'}}};},getTransactions:async()=>[]});
  h.render();h.effects[0]();await new Promise(setImmediate);
  assert.equal(h.values[3],'Synthetic finance failure');
});
