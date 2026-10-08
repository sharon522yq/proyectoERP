// Browser QA: Render requests are intercepted and fulfilled by a real isolated
// temporary backend. No requests with credentials are sent to production.
process.env.NODE_ENV = 'test';
process.env.AI_ENABLED = 'false';
process.env.CORS_ORIGINS = 'http://localhost:8090';
require('./mongo-ports');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let db, apiServer, webServer, ws;
  const steps = [], requests = [];
  try {
    db = await createTestDatabase(); await mongoose.connect(db.getUri());
    process.env.INITIAL_SETUP_TOKEN = crypto.randomBytes(32).toString('hex');
    const password = crypto.randomBytes(24).toString('hex');
    await require('../src/modules/auth/setup.service').initialize({ name: 'Synthetic Owner', email: 'owner@example.invalid', companyName: 'Synthetic Company', password }, process.env.INITIAL_SETUP_TOKEN);
    const company = await require('../src/modules/companies/company.model').findOne({ name: 'Synthetic Company' });
    const customer = await require('../src/modules/crm/customer.model').create({ companyId: company._id, name: 'Cliente QA' });
    const product = await require('../src/modules/products/product.model').create({ companyId: company._id, sku: 'UI-QA', name: 'Producto QA', price: 100 });
    await require('../src/modules/products/product.model').create({ companyId: company._id, sku: 'DELETE-QA', name: 'Producto eliminable', price: 20 });
    await require('../src/modules/crm/lead.model').create({ companyId: company._id, name: 'Lead eliminable' });
    const warehouse = await require('../src/modules/inventory/warehouse.model').create({ companyId: company._id, name: 'Almacén QA', code: 'QA' });
    await require('../src/modules/finance/account.model').create({ companyId: company._id, code: 'QA100', name: 'Cuenta QA', type: 'ASSET', balance: 123 });
    await require('../src/modules/hr/employee.model').create({ companyId: company._id, employeeId: 'QA001', name: 'Empleado QA' });
    await require('../src/modules/projects/project.model').create({ companyId: company._id, name: 'Proyecto QA' });
    await require('../src/modules/inventory/warehouse.model').create({ companyId: company._id, name: 'Almacén eliminable', code: 'DELETE-WH' });
    apiServer = createApp().listen(8091, '127.0.0.1');
    webServer = express().use(express.static(path.resolve(__dirname, '../../frontend/dist'))).listen(8090, '127.0.0.1');
    const tabs = await (await fetch('http://127.0.0.1:9337/json')).json();
    const tab = tabs.find(t => t.type === 'page');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise(resolve => { const key = ++id; pending.set(key, resolve); ws.send(JSON.stringify({ id: key, method, params })); });
    let runtimeFailure = false;
    let transportFailure = false, failProducts = false, delayProducts = false;
    ws.addEventListener('message', async event => {
      const msg = JSON.parse(event.data);
      if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); }
      if (msg.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = msg.params;
      try {
        const url = new URL(request.url);
        if (url.origin !== 'https://proyectoerp-api.onrender.com') throw new Error('UNEXPECTED_HOST');
        if(request.method==='GET' && url.pathname==='/api/v1/products') {if(delayProducts){delayProducts=false;await pause(1800);}if(failProducts){failProducts=false;requests.push({method:'GET',path:url.pathname,status:503,destination:'injected-isolated-failure'});await send('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:[{name:'access-control-allow-origin',value:'http://localhost:8090'},{name:'content-type',value:'application/json'}],body:Buffer.from(JSON.stringify({message:'Error sintético de QA'})).toString('base64')});return;}}
        const headers = { Origin: 'http://localhost:8090' };
        for (const [key, value] of Object.entries(request.headers)) if (['authorization','content-type','access-control-request-method','access-control-request-headers'].includes(key.toLowerCase())) headers[key] = value;
        const response = await fetch('http://127.0.0.1:8091' + url.pathname + url.search, { method: request.method, headers, body: ['GET','HEAD'].includes(request.method) ? undefined : request.postData });
        const body = Buffer.from(await response.arrayBuffer()).toString('base64');
        requests.push({ method: request.method, path: url.pathname, status: response.status, destination: 'isolated-test-backend' });
        await send('Fetch.fulfillRequest', { requestId, responseCode: response.status, responseHeaders: [...response.headers].filter(([k]) => !['content-length','content-encoding','transfer-encoding'].includes(k)).map(([name,value]) => ({ name,value })), body });
      } catch { transportFailure = true; await send('Fetch.failRequest', { requestId, errorReason: 'Failed' }); }
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.result?.exceptionDetails) throw new Error('BROWSER_EVALUATION_FAILED');
      return result.result?.result?.value;
    };
    const wait = async (expression, label) => {
      for (let i = 0; i < 60; i++) { if (await evaluate(expression).catch(() => false)) { steps.push(label); console.log(JSON.stringify({ passed: label })); return; } await pause(500); }
      throw new Error('UI_TIMEOUT_' + label);
    };
    const click = async text => {
      for(let i=0;i<60;i++) {
        const clicked = await evaluate(`(() => { const button=[...document.querySelectorAll('[role=button],button')].find(e => (e.textContent===${JSON.stringify(text)} || e.getAttribute('aria-label')===${JSON.stringify(text)}) && e.getClientRects().length && e.getAttribute('aria-disabled')!=='true' && !e.disabled); if(!button)return false;button.click();return true;})()`);
        if(clicked)return; await pause(200);
      }
      throw new Error('BUTTON_NOT_READY');
    };
    const fill = values => evaluate(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const inputs=[...document.querySelectorAll('input')]; const values=${JSON.stringify(values)}; for(let i=0;i<values.length;i++){setter.call(inputs[i],values[i]);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));} })()`);
    await send('Runtime.enable');
    ws.addEventListener('message', event => { const m=JSON.parse(event.data); if(m.method==='Runtime.exceptionThrown') runtimeFailure=true; });
    await send('Fetch.enable', { patterns: [{ urlPattern: 'https://proyectoerp-api.onrender.com/*', requestStage: 'Request' }] });

    const output='C:/proyectoERP/.local/nexus-design';fs.mkdirSync(output,{recursive:true});
    const resize=async width=>{await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause(350);};
    const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(output+'/'+name+'.png',Buffer.from(r.result.data,'base64'));};
    const overflow=async label=>{const r=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');if(r.scroll>r.width+1)throw new Error('OVERFLOW_'+label);steps.push('no_overflow_'+label);};
    await resize(1440);await send('Storage.clearDataForOrigin',{origin:'http://localhost:8090',storageTypes:'local_storage'});await send('Page.navigate',{url:'http://localhost:8090'});
    await wait("document.body.textContent.includes('Crear cuenta')",'login_loaded');
    await wait("[...document.fonts].filter(f=>f.family.includes('SourceSansPro') && f.status==='loaded').length>=3",'fonts_loaded');
    await shot('login-desktop');
    for(const width of [360,390,768,1024,1440,1920]){await resize(width);await overflow('login_'+width);if(width===390)await shot('login-mobile');}
    await resize(1440);await fill(['owner@example.invalid',password]);await click('Iniciar sesión');await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')",'login_dashboard');
    await shot('dashboard-desktop');
    for(const width of [360,390,768,1024,1440,1920]){await resize(width);await overflow('dashboard_'+width);if(width===390)await shot('dashboard-mobile');}
    await resize(1440);
    const routes=['CRM','Productos','Inventario','Ventas','Compras','Finanzas','RRHH','Proyectos','Producción','Usuarios y Roles','Configuración','Auditoría','Asistente IA'];
    const titles=await evaluate("[...document.querySelectorAll('[role=button]')].map(e=>e.getAttribute('aria-label')).filter(Boolean)");console.log(JSON.stringify({navigation:titles}));
    for(const label of routes){if(!titles.includes(label))throw Error('MISSING_MODULE_'+label);await click(label);await pause(1000);await overflow(label+'_desktop');await resize(390);await overflow(label+'_mobile');await resize(1440);}
    await click('Dashboard');delayProducts=true;await click('Productos');await wait("document.body.textContent.includes('Cargando datos')",'loading_state');await shot('loading-state');await wait("document.body.textContent.includes('Producto QA')",'products_loaded');await shot('products-desktop');
    await click('Nuevo Producto');await wait("document.body.textContent.includes('Crear Nuevo Producto')",'product_modal_open');await pause(200);await shot('product-modal-desktop');
    await resize(390);await shot('product-modal-mobile');await overflow('modal_mobile');
    const modalVisible=await evaluate("[...document.querySelectorAll('input')].some(e=>e.getAttribute('aria-label')==='Nombre del producto'&&e.getClientRects().length)");if(!modalVisible)throw Error('MODAL_INACCESSIBLE');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.body.textContent.includes('Crear Nuevo Producto')",'modal_escape');
    await click('Abrir menú de módulos');await wait("document.body.textContent.includes('Cerrar menú')",'mobile_menu');await shot('mobile-navigation');await click('Cerrar menú');await wait("!document.body.textContent.includes('Cerrar menú')",'mobile_menu_closed');
    await resize(390);await shot('products-mobile');await overflow('products_mobile');
    const menu=await evaluate("[...document.querySelectorAll('[role=button]')].map(e=>e.getAttribute('aria-label'))");console.log(JSON.stringify({productButtons:menu}));
    await resize(1440);await click('Dashboard');failProducts=true;await click('Productos');await wait("document.body.textContent.includes('Reintentar')",'error_state');await shot('error-state');await click('Reintentar');await wait("document.body.textContent.includes('Producto QA')",'retry_recovers');
    await click('CRM');await click('Eliminar');await click('Confirmar');await wait("document.body.textContent.includes('No hay prospectos')",'empty_state');await shot('empty-state');
    await resize(1440);await click('Volver');await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')",'back_dashboard');
    await send('Page.reload');await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')",'session_reload');
    await click('Salir');await wait("document.body.textContent.includes('Crear cuenta')",'logout');
    if(transportFailure)throw new Error('TRANSPORT_FAILURE');
    if(runtimeFailure)throw new Error('JS_RUNTIME_FAILURE');
    if(requests.some(r=>r.status>=400 && r.destination!=='injected-isolated-failure'))throw new Error('UNEXPECTED_API_FAILURE');
    fs.writeFileSync(output+'/report.json',JSON.stringify({environment:'isolated temporary MongoDB; intercepted Render transport, no production writes',steps,requests},null,2));console.log(JSON.stringify({passed:steps.length}));
  } finally {
    if (ws) ws.close();
    if (webServer) { webServer.closeAllConnections(); await new Promise(r => webServer.close(r)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(r => apiServer.close(r)); }
    await mongoose.disconnect(); if (db) await db.stop();
    delete process.env.INITIAL_SETUP_TOKEN;
  }
})().catch(error => { console.error(/^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'BROWSER_QA_FAILED'); process.exitCode = 1; });
