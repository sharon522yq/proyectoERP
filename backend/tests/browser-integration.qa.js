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
    apiServer = createApp().listen(8091, '127.0.0.1');
    webServer = express().use(express.static(path.resolve(__dirname, '../../frontend/dist'))).listen(8090, '127.0.0.1');
    const tabs = await (await fetch('http://127.0.0.1:9336/json')).json();
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
      for (let i = 0; i < 60; i++) { if (await evaluate(expression)) { steps.push(label); console.log(JSON.stringify({ passed: label })); return; } await pause(500); }
      throw new Error('UI_TIMEOUT_' + label);
    };
    const click = text => evaluate(`(() => { const button = [...document.querySelectorAll('[role=button],button')].find(e=>e.textContent === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!button) throw new Error('BUTTON_MISSING'); button.click(); })()`);
    const fill = values => evaluate(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const inputs=[...document.querySelectorAll('input')]; const values=${JSON.stringify(values)}; for(let i=0;i<values.length;i++){setter.call(inputs[i],values[i]);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));} })()`);
    await send('Fetch.enable', { patterns: [{ urlPattern: 'https://proyectoerp-api.onrender.com/*', requestStage: 'Request' }] });
    await send('Page.navigate', { url: 'http://localhost:8090' });
    await wait("document.body.innerText.includes('Crear cuenta')", 'login_loaded');
    await click('Crear cuenta'); await pause(300);
    await fill(['Synthetic Public', 'public@example.invalid', password, password]);
    await click('Crear cuenta');
    await wait("document.body.innerText.includes('Tu cuenta está creada')", 'registration_pending_company');
    await click('Cerrar sesión');
    await wait("!!document.querySelector('input[aria-label=\"Correo electrónico\"]')", 'pending_logout');
    // DOM-only assignment simulates password-manager autofill without change events.
    await evaluate(`document.querySelector('input[aria-label="Correo electrónico"]').value='owner@example.invalid'; document.querySelector('input[aria-label="Contraseña"]').value=${JSON.stringify(password)};`);
    await click('Iniciar sesión');
    await wait("document.body.innerText.includes('Bienvenido, Synthetic Owner')", 'autofill_login_dashboard');
    await click('Productos');
    await wait("document.body.innerText.includes('Catálogo') || document.body.innerText.includes('Nuevo producto')", 'products_navigation');
    await send('Page.reload');
    await wait("document.body.innerText.includes('Bienvenido, Synthetic Owner')", 'session_reload');
    await send('Page.captureScreenshot', { format: 'png' }).then(r => { if (r.result?.data) fs.writeFileSync('docs/integration-dashboard.png', Buffer.from(r.result.data,'base64')); });
    await click('Salir');
    await wait("document.body.innerText.includes('Crear cuenta')", 'logout');
    await fill(['owner@example.invalid', password]); await click('Iniciar sesión');
    await wait("document.body.innerText.includes('Bienvenido, Synthetic Owner')", 'manual_login');
    if (transportFailure) throw new Error('TRANSPORT_FAILURE');
    fs.writeFileSync('docs/browser-integration.json', JSON.stringify({ environment: 'isolated temporary MongoDB, intercepted Render transport; no production test', steps, requests },null,2));
    console.log(JSON.stringify({ passed: steps }));
  } finally {
    if (ws) ws.close();
    if (webServer) { webServer.closeAllConnections(); await new Promise(r => webServer.close(r)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(r => apiServer.close(r)); }
    await mongoose.disconnect(); if (db) await db.stop();
    delete process.env.INITIAL_SETUP_TOKEN;
  }
})().catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'BROWSER_QA_FAILED'); process.exitCode = 1; });
