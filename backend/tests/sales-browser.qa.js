// Browser QA: Render requests are intercepted and fulfilled by a real isolated
// temporary backend. No requests with credentials are sent to production.
process.env.NODE_ENV = 'test';
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
    const click = text => evaluate(`(() => { const button = [...document.querySelectorAll('[role=button],button')].find(e=>e.textContent === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!button) throw new Error('BUTTON_MISSING'); button.click(); })()`);
    const fill = values => evaluate(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const inputs=[...document.querySelectorAll('input')]; const values=${JSON.stringify(values)}; for(let i=0;i<values.length;i++){setter.call(inputs[i],values[i]);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));} })()`);
    await send('Runtime.enable');
    ws.addEventListener('message', event => { const m=JSON.parse(event.data); if(m.method==='Runtime.exceptionThrown') console.log('JS_ERROR', m.params.exceptionDetails.exception?.description?.split('\n')[0]); });
    await send('Fetch.enable', { patterns: [{ urlPattern: 'https://proyectoerp-api.onrender.com/*', requestStage: 'Request' }] });
    await send('Page.navigate', { url: 'http://localhost:8090' });
    await wait("document.body.textContent.includes('Crear cuenta')", 'login_loaded');
    await fill(['owner@example.invalid', password]);
    await click('Iniciar sesión');
    await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'login_dashboard');
    await click('Inventario');
    await wait("document.body.textContent.includes('Nuevo almacén')", 'inventory_loaded');
    await click('Nuevo almacén'); await fill(['Almacén UI', 'UI']); await click('Guardar almacén');
    await wait("document.body.textContent.includes('Almacén UI (UI)')", 'warehouse_created');
    await click('Ajuste de Stock');
    await click('Producto QA'); await click('Almacén UI');
    const warehouse = await require('../src/modules/inventory/warehouse.model').findOne({ companyId: company._id });
    await fill([String(product._id), String(warehouse._id), '10', 'Existencias sintéticas QA']);
    await click('Confirmar Ajuste');
    await wait("document.body.textContent.includes('10 u.')", 'stock_registered');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'back_to_dashboard'); await click('Ventas');
    await wait("document.body.textContent.includes('Nueva cotización')", 'sales_loaded');
    await click('Nueva cotización');
    await wait("document.body.textContent.includes('Cliente QA')", 'catalog_loaded');
    await click('Cliente QA'); await click('Producto QA (100.00 MXN)');
    await fill(['2', '100', '16']);
    await click('Guardar cotización');
    await wait("document.body.textContent.includes('COT-000001')", 'quote_created');
    await click('Aprobar cotización');
    await wait("document.body.textContent.includes('Convertir a pedido')", 'quote_approved');
    await click('Convertir a pedido');
    await wait("document.body.textContent.includes('PED-000001')", 'order_created');
    await click('Confirmar pedido y descontar stock');
    await click('Confirmar salida de existencias');
    await wait("document.body.textContent.includes('Generar factura interna')", 'order_confirmed');
    await click('Generar factura interna');
    await wait("document.body.textContent.includes('FAC-000001') && document.body.textContent.includes('232.00 MXN')", 'invoice_created');
    await evaluate("window.open=()=>({document:{write:html=>window.__invoicePrint=html,close:()=>{}},focus:()=>{},print:()=>{window.__printed=true}})");
    await click('Imprimir / Guardar PDF');
    await wait("window.__printed && window.__invoicePrint.includes('Synthetic Company') && window.__invoicePrint.includes('232.00 MXN')", 'print_document');
    await send('Page.captureScreenshot', { format: 'png' }).then(r => { if (r.result?.data) fs.writeFileSync('C:/proyectoERP/.local/sales-invoice-qa.png', Buffer.from(r.result.data,'base64')); });
    await click('Volver'); await send('Page.reload');
    await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'session_reload');
    await click('Ventas'); await click('Facturas');
    await wait("document.body.textContent.includes('FAC-000001')", 'invoice_persisted');

    if (transportFailure) throw new Error('TRANSPORT_FAILURE');
    fs.writeFileSync('C:/proyectoERP/.local/sales-browser-qa.json', JSON.stringify({ environment: 'isolated temporary MongoDB, intercepted Render transport; no production test', steps, requests },null,2));
    console.log(JSON.stringify({ passed: steps }));
  } finally {
    if (ws) ws.close();
    if (webServer) { webServer.closeAllConnections(); await new Promise(r => webServer.close(r)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(r => apiServer.close(r)); }
    await mongoose.disconnect(); if (db) await db.stop();
    delete process.env.INITIAL_SETUP_TOKEN;
  }
})().catch(error => { console.error(/^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'BROWSER_QA_FAILED'); process.exitCode = 1; });

