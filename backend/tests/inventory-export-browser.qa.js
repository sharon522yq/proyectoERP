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
  let db, apiServer, webServer, ws; let stage = 'database';
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
    stage = 'browser_connection';
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
    stage = 'browser_steps';
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
    const downloads = [];
    const downloadPath = 'C:/proyectoERP/.local/inventory-export-browser'; fs.mkdirSync(downloadPath, { recursive: true });
    ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Browser.downloadWillBegin') downloads.push({ guid: m.params.guid, filename: m.params.suggestedFilename }); });
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
    await require('../src/modules/inventory/inventory.model').create({ companyId: company._id, productId: product._id, warehouseId: warehouse._id, quantity: 12, reservedQty: 3 });
    await click('Inventario'); await wait(visible('Exportar inventario a Excel'), 'export_button_visible');
    await click('Exportar inventario a Excel'); await wait(visible('Descarga iniciada'), 'download_started');
    const waitFile = async count => { for (let i = 0; i < 60; i++) { if (downloads.length >= count && fs.existsSync(path.join(downloadPath, downloads[count - 1].filename))) return path.join(downloadPath, downloads[count - 1].filename); await pause(500); } throw new Error('DOWNLOAD_MISSING'); };
    const file = await waitFile(1); const book = new (require('exceljs').Workbook)(); await book.xlsx.readFile(file);
    if (book.getWorksheet('Inventario').getCell('H5').value !== 12 || book.getWorksheet('Inventario').getCell('J5').value !== 9) throw new Error('WORKBOOK_VALUES_INVALID'); steps.push('actual_xlsx_download_verified');
    await click('Gestionar: Almacén QA (QA)'); await wait(visible('Exportar este almacén a Excel'), 'warehouse_export_visible');
    await click('Exportar este almacén a Excel'); await wait(visible('Descarga iniciada'), 'warehouse_download_started'); await waitFile(2); steps.push('warehouse_download_verified');
    const exportRequests = requests.slice(authenticatedRequestStart).filter(r => r.path === '/api/v1/inventory/export.xlsx');
    if (exportRequests.filter(r => r.method === 'GET' && r.status === 200).length !== 2 || transportFailure) throw new Error('EXPORT_HTTP_INVALID');
    fs.writeFileSync(path.join(downloadPath, 'evidence.json'), JSON.stringify({ environment: 'isolated temporary MongoDB; Render transport intercepted; no production test', steps, requests: exportRequests }, null, 2));
    const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(downloadPath, 'export.png'), Buffer.from(shot.result.data, 'base64'));
    console.log(JSON.stringify({ passed: steps, downloads: downloads.map(d => d.filename) }));
  } catch (error) { console.error('QA_STAGE', stage, error.code || error.cause?.code || 'UNEXPECTED_ERROR'); throw error; } finally {
    if (ws) ws.close();
    if (webServer) { webServer.closeAllConnections(); await new Promise(r => webServer.close(r)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(r => apiServer.close(r)); }
    await mongoose.disconnect(); if (db) await db.stop();
    delete process.env.INITIAL_SETUP_TOKEN;
  }
})().catch(error => { console.error(/^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'BROWSER_QA_FAILED'); process.exitCode = 1; });

