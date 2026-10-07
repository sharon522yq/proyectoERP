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
    let transportFailure = false;
    ws.addEventListener('message', async event => {
      const msg = JSON.parse(event.data);
      if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); }
      if (msg.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = msg.params;
      try {
        const url = new URL(request.url);
        if (url.origin !== 'https://proyectoerp-api.onrender.com') throw new Error('UNEXPECTED_HOST');
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
    ws.addEventListener('message', event => { const m=JSON.parse(event.data); if(m.method==='Runtime.exceptionThrown') console.log('JS_ERROR', m.params.exceptionDetails.exception?.description?.split('\n')[0]); });
    await send('Fetch.enable', { patterns: [{ urlPattern: 'https://proyectoerp-api.onrender.com/*', requestStage: 'Request' }] });
    await send('Page.navigate', { url: 'http://localhost:8090' });
    await wait("document.body.textContent.includes('Crear cuenta')", 'login_loaded');
    await fill(['owner@example.invalid', password]);
    await click('Iniciar sesión');
    await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'login_dashboard');
    const authenticatedRequestStart = requests.length;
    const visible = text => 'document.body.textContent.includes(' + JSON.stringify(text) + ')';
    const field = (label, value) => evaluate(`(() => { const input=[...document.querySelectorAll('input')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)} || e.placeholder===${JSON.stringify(label)}); if(!input)throw new Error('FIELD_MISSING'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    const rowAction = (name, title) => evaluate(`(() => {const label=[...document.querySelectorAll('div')].find(e=>e.textContent===${JSON.stringify(name)}); const row=label?.parentElement?.parentElement; const button=[...row.querySelectorAll('[role=button],button')].find(e=>e.textContent===${JSON.stringify(title)}); if(!button)throw new Error('ROW_BUTTON_MISSING');button.click();})()`);
    const dashboard = async () => { await click('Volver'); await wait(visible('Bienvenido, Synthetic Owner'),'dashboard'); };
    await click('CRM'); await wait(visible('Lead eliminable'),'lead_loaded');
    await click('Eliminar'); await wait(visible('Confirmar'),'lead_confirmation'); await click('Cancelar'); await wait("![...document.querySelectorAll('[role=button],button')].some(e => e.textContent==='Confirmar')", 'confirmation_closed');
    await wait(visible('Lead eliminable'),'lead_cancel_preserves');
    await click('Eliminar'); await click('Confirmar'); await wait(visible('No hay leads'),'lead_removed'); await dashboard();
    await click('Productos'); await wait(visible('Producto eliminable'),'products_loaded');
    await rowAction('Producto eliminable','Eliminar'); await click('Confirmar');
    await wait('!document.body.textContent.includes("Producto eliminable")','product_removed');
    await rowAction('Producto QA','Desactivar'); await click('Confirmar'); await wait(visible('INACTIVE'),'product_inactive');
    await rowAction('Producto QA','Activar'); await click('Confirmar'); await wait("[...document.querySelectorAll('div')].some(e=>e.textContent==='ACTIVE')",'product_active'); await dashboard();
    await click('Inventario'); await wait(visible('Gestionar: Almacén QA'),'warehouse_list');
    await click('Gestionar: Almacén QA (QA)'); await wait("[...document.querySelectorAll('[role=button],button')].some(e => e.textContent==='Guardar cambios del almacén' && e.getAttribute('aria-disabled')!=='true' && !e.disabled)",'warehouse_details');
    await field('Nombre del almacén','Almacén editado'); await field('Dirección del almacén','Dirección sintética');
    await click('Guardar cambios del almacén'); await wait(visible('Almacén actualizado'),'warehouse_saved');
    await wait(visible('Almacén: Almacén editado'),'warehouse_edited');
    await click('Ajustar existencias de este almacén'); await wait(visible('Ajuste Autorizado de Stock'),'warehouse_adjust_form');
    await click('Producto QA'); await field('Cantidad (+/-)','3'); await field('Motivo obligatorio del ajuste','Existencias sintéticas');
    await click('Confirmar Ajuste'); await wait(visible('3 u.'),'stock_saved');
    await click('Gestionar: Almacén editado (QA)'); await wait(visible('Historial de movimientos (1)'),'warehouse_history');
    await click('Eliminar'); await click('Confirmar'); await wait(visible('documentos relacionados'),'warehouse_delete_blocked'); await click('Cancelar'); await wait("![...document.querySelectorAll('[role=button],button')].some(e => e.textContent==='Confirmar')", 'confirmation_closed');
    await click('Desactivar'); await wait(visible('Desactivar: Almacén editado'),'warehouse_deactivation_confirmation'); await click('Confirmar'); await wait(visible('no puede desactivarse'),'warehouse_deactivate_blocked'); await click('Cancelar'); await wait("![...document.querySelectorAll('[role=button],button')].some(e => e.textContent==='Confirmar')", 'confirmation_closed');
    await click('Volver a inventario'); await wait(visible('Gestionar: Almacén eliminable'),'empty_warehouse_list');
    await click('Gestionar: Almacén eliminable (DELETE-WH)'); await wait(visible('Almacén: Almacén eliminable'),'empty_warehouse_details');
    await click('Desactivar'); await wait(visible('Desactivar: Almacén eliminable'),'empty_deactivation_confirmation'); await click('Confirmar'); await wait(visible('Estado: Desactivado'),'empty_warehouse_inactive');
    await click('Activar'); await wait(visible('Activar: Almacén eliminable'),'empty_activation_confirmation'); await click('Confirmar'); await wait(visible('Estado: Activo'),'empty_warehouse_active');
    await click('Eliminar'); await wait(visible('Eliminar: Almacén eliminable'),'empty_deletion_confirmation'); await click('Confirmar');
    await wait('!document.body.textContent.includes("Almacén eliminable") && document.body.textContent.includes("Gestionar: Almacén editado")','empty_warehouse_removed'); await dashboard();
    await click('Productos'); await wait(visible('Producto QA'),'used_product_loaded');
    await rowAction('Producto QA','Eliminar'); await click('Confirmar'); await wait(visible('Desactívalo'),'used_product_delete_blocked'); await click('Cancelar'); await wait("![...document.querySelectorAll('[role=button],button')].some(e => e.textContent==='Confirmar')", 'confirmation_closed'); await dashboard();
    await send('Page.navigate', { url: 'http://localhost:8090' }); await wait(visible('Bienvenido, Synthetic Owner'),'reload_session');
    await click('CRM'); await wait(visible('No hay leads'),'lead_delete_persisted'); await dashboard();
    await click('Productos'); await wait('!document.body.textContent.includes("Producto eliminable") && document.body.textContent.includes("Producto QA")','product_delete_persisted'); await dashboard();
    await click('Inventario'); await wait(visible('Gestionar: Almacén editado (QA)'), 'warehouse_reload_list'); await click('Gestionar: Almacén editado (QA)'); await wait(visible('Historial de movimientos (1)'),'warehouse_reload_persisted');
    fs.mkdirSync('C:/proyectoERP/.local/catalog-management',{recursive:true}); const shot=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('C:/proyectoERP/.local/catalog-management/warehouse.png',Buffer.from(shot.result.data,'base64'));
    const failures=requests.slice(authenticatedRequestStart).filter(r=>r.status>=400 && r.status!==409);
    if(failures.length) { console.log(JSON.stringify(failures)); throw new Error('MODULE_HTTP_FAILURE'); }
    if (transportFailure) throw new Error('TRANSPORT_FAILURE');
    fs.writeFileSync('C:/proyectoERP/.local/catalog-management-browser-qa.json', JSON.stringify({ environment: 'isolated temporary MongoDB, intercepted Render transport; no production test', steps, requests },null,2));
    console.log(JSON.stringify({ passed: steps }));
  } finally {
    if (ws) ws.close();
    if (webServer) { webServer.closeAllConnections(); await new Promise(r => webServer.close(r)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(r => apiServer.close(r)); }
    await mongoose.disconnect(); if (db) await db.stop();
    delete process.env.INITIAL_SETUP_TOKEN;
  }
})().catch(error => { console.error(/^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'BROWSER_QA_FAILED'); process.exitCode = 1; });

