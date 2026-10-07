const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const filename = require.resolve('../src/components/CatalogActions.js');
const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code;
function harness(props) {
  let index=0; const slots=[];
  const react={createElement:(type,props,...children)=>({type,props,children}),useState:initial=>{const n=index++;if(!(n in slots))slots[n]=initial;return[slots[n],v=>slots[n]=v];},useRef:initial=>{const n=index++;if(!(n in slots))slots[n]={current:initial};return slots[n];}};
  const context={exports:{},require:name=>name==='react'?react:{View:'View',Text:'Text',Button:'Button',Modal:'Modal',StyleSheet:{create:x=>x}}};vm.runInNewContext(code,context);
  const render=()=>{index=0;return context.exports.default(props);};
  function nodes(tree,filter){let all=[];function visit(n){if(Array.isArray(n))n.forEach(visit);else if(n&&typeof n==='object'){if(filter(n))all.push(n);visit(n.children);}}visit(tree);return all;}
  return {render,nodes,button:title=>nodes(render(),n=>n.type==='Button'&&n.props.title===title)[0],slots};
}
test('delete requires confirmation and cancellation performs no request',()=>{
  let calls=0;const h=harness({name:'Synthetic',onDelete:()=>calls++,onChanged:()=>{}});
  h.button('Eliminar').props.onPress();h.button('Cancelar').props.onPress();
  assert.equal(calls,0);assert.equal(h.slots[0],null);
});
test('confirmed deletion prevents concurrent clicks and refreshes the list',async()=>{
  let calls=0,changed=0,resolve;const promise=new Promise(r=>resolve=r);
  const h=harness({name:'Synthetic',onDelete:()=>{calls++;return promise;},onChanged:()=>changed++});
  h.button('Eliminar').props.onPress();const confirm=h.button('Confirmar').props.onPress;
  const a=confirm(),b=confirm();assert.equal(calls,1);assert.equal(h.button('Confirmar').props.disabled,true);
  resolve();await Promise.all([a,b]);assert.equal(changed,1);assert.equal(h.slots[0],null);
});
test('dependency rejection remains visible and does not refresh a successful result',async()=>{
  let changed=0;const h=harness({name:'Synthetic',onDelete:async()=>{throw {response:{data:{message:'Synthetic dependency conflict'}}};},onChanged:()=>changed++});
  h.button('Eliminar').props.onPress();await h.button('Confirmar').props.onPress();
  assert.equal(h.slots[2],'Synthetic dependency conflict');assert.equal(h.slots[0],'delete');assert.equal(changed,0);
});
test('without allowed callbacks no management actions are displayed',()=>{
  const h=harness({name:'Read only'});assert.equal(h.button('Eliminar'),undefined);assert.equal(h.button('Desactivar'),undefined);
});
