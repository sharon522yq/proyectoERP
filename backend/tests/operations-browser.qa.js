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
    const finished = await require('../src/modules/products/product.model').create({ companyId: company._id, sku: 'FINISHED-QA', name: 'Terminado QA', price: 200 });
    await require('../src/modules/production/bom.model').create({ companyId: company._id, productId: finished._id, name: 'Receta QA', items: [{ componentProductId: product._id, quantity: 2, unitCost: 1 }] });
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
        const clicked = await evaluate(`(() => { const button=[...document.querySelectorAll('[role=button],[role=checkbox],button')].find(e => (e.textContent===${JSON.stringify(text)} || e.getAttribute('aria-label')===${JSON.stringify(text)}) && e.getClientRects().length && e.getAttribute('aria-disabled')!=='true' && !e.disabled); if(!button)return false;button.click();return true;})()`);
        if(clicked)return; await pause(200);
      }
      throw new Error('BUTTON_NOT_READY');
    };
    const fill = values => evaluate(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const inputs=[...document.querySelectorAll('input')]; const values=${JSON.stringify(values)}; for(let i=0;i<values.length;i++){setter.call(inputs[i],values[i]);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));} })()`);
    const fillLabelsNow = values => evaluate(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; for(const [label,value] of Object.entries(${JSON.stringify(values)})){const input=[...document.querySelectorAll('input,textarea')].find(element=>element.getAttribute('aria-label')===label);if(!input)throw new Error('INPUT_NOT_FOUND');const valueSetter=Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;valueSetter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));} })()`);
    const fillLabels = async values => {
      for(let index=0;index<60;index++) {
        const ready = await evaluate(`Object.keys(${JSON.stringify(values)}).every(label => [...document.querySelectorAll('input,textarea')].some(element => element.getAttribute('aria-label') === label && element.getClientRects().length))`);
        if(ready) return fillLabelsNow(values); await pause(200);
      }
      throw new Error('INPUT_NOT_READY');
    };
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
    await click('Seleccionar producto');await click('Producto QA'); await click('Seleccionar almacén');await click('Almacén UI');
    const warehouse = await require('../src/modules/inventory/warehouse.model').findOne({ companyId: company._id });
    await fill(['10', 'Existencias sintéticas QA']);
    await click('Confirmar Ajuste');
    await wait("document.body.textContent.includes('10 u.')", 'stock_registered');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'back_to_dashboard'); await click('Ventas');
    await wait("document.body.textContent.includes('Nueva cotización')", 'sales_loaded');
    await click('Nueva cotización');
    await wait("document.body.textContent.includes('Seleccionar cliente')", 'catalog_loaded');
    await click('Seleccionar cliente'); await click('Cliente QA'); await click('Seleccionar producto de partida 1'); await click('Producto QA (100.00 MXN)');
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
    await send('Page.captureScreenshot', { format: 'png' }).then(r => { if (r.result?.data) fs.writeFileSync('C:/proyectoERP/.local/operations-qa.png', Buffer.from(r.result.data,'base64')); });
    await click('Registrar cobro');
    await wait("document.body.textContent.includes('Importe recibido')", 'payment_form');
    await click('Confirmar dinero recibido');
    await wait("document.body.textContent.includes('Estado: Pagada')", 'payment_confirmed');
    await click('Volver');
    await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_purchase');
    await click('Compras'); await click('Nueva compra');
    await wait("document.body.textContent.includes('Seleccionar proveedor')", 'purchase_catalog');
    await click('Seleccionar proveedor'); await click('Cliente QA'); await click('Seleccionar almacén de recepción'); await click('Almacén UI'); await click('Seleccionar producto de partida 1'); await click('Producto QA');
    await click('Guardar borrador');
    await wait("document.body.textContent.includes('OC-000001')", 'purchase_created');
    await click('Confirmar con proveedor'); await wait("document.body.textContent.includes('Confirma que el proveedor')", 'purchase_confirmation'); await click('Confirmar operación');
    await wait("document.body.textContent.includes('Registrar recepción completa')", 'purchase_confirmed');
    await click('Registrar recepción completa'); await wait("document.body.textContent.includes('Confirma únicamente si recibiste')", 'receipt_confirmation'); await click('Confirmar operación');
    await wait("document.body.textContent.includes('Estado: Recibida')", 'purchase_received');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_production');
    await click('Producción'); await click('Nueva orden de producción');
    await click('Seleccionar receta'); await click('Receta QA · Terminado QA');
    await click('Seleccionar almacén de producción'); await click('Almacén UI');
    await click('Guardar orden en borrador');
    await wait("document.body.textContent.includes('PROD-000001')", 'production_created');
    for (const label of ['Planificar', 'Liberar orden', 'Iniciar producción']) {
      await click(label); await wait("document.body.textContent.includes('Revisar operación')", 'production_confirm_' + label.replaceAll(' ', '_'));
      await click('Confirmar operación de producción'); await wait("!document.body.textContent.includes('Revisar operación')", 'production_transition_' + label.replaceAll(' ', '_'));
    }
    await click('Registrar consumo de materiales'); await click('Confirmar operación de producción');
    await wait("!document.body.textContent.includes('Revisar operación')", 'production_consumed');
    await click('Finalizar fabricación'); await click('Confirmar operación de producción');
    await wait("document.body.textContent.includes('Estado: Terminada')", 'production_completed');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_catalogs');
    await click('Productos'); await click('Editar Producto QA');
    await fillLabels({ 'Nombre del producto': 'Producto QA', 'SKU del producto': 'UI-QA', 'Precio de venta': '100', 'Costo del producto': '5' }); await click('Guardar cambios');
    await wait("!document.body.textContent.includes('Editar producto')", 'product_edited');
    const editedProduct = await require('../src/modules/products/product.model').findById(product._id); if(editedProduct.cost !== 5) throw new Error('PRODUCT_EDIT_NOT_PERSISTED');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_customer');
    await click('CRM'); await click('Clientes y proveedores'); await click('Nuevo cliente / proveedor');
    await fillLabels({ 'Nombre del cliente o proveedor': 'Cliente UI', 'Correo del cliente o proveedor': 'synthetic@example.invalid' }); await click('Guardar cliente / proveedor');
    await wait("document.body.textContent.includes('Editar Cliente UI')", 'customer_created');
    await click('Editar Cliente UI'); await fillLabels({ 'Nombre del cliente o proveedor': 'Cliente editado UI' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('Editar Cliente editado UI')", 'customer_edited');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_hr');
    await click('RRHH'); await click('Nuevo empleado');
    await fillLabels({ 'Código de empleado': 'EMP-UI', 'Nombre completo': 'Empleado UI', 'Puesto': 'Operaciones' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('EMP-UI')", 'employee_created');
    await click('Editar Empleado UI'); await fillLabels({ 'Puesto': 'Supervisor QA' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('Supervisor QA')", 'employee_updated');
    await click('Desactivar ficha'); await click('Confirmar estado de ficha'); await wait("document.body.textContent.includes('Estado: Inactivo')", 'employee_deactivated');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_projects');
    await click('Proyectos'); await click('Nuevo proyecto');
    await fillLabels({ 'Nombre del proyecto': 'Proyecto UI', 'Objetivo y alcance': 'Trabajo sintético de QA', 'Presupuesto de referencia': '100' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('Ver tareas de Proyecto UI')", 'project_created');
    await click('Ver tareas de Proyecto UI'); await click('Nueva tarea');
    await fillLabels({ 'Nombre de la tarea': 'Tarea UI' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('Tarea UI')", 'task_created');
    await click('Finalizar proyecto'); await click('Confirmar cambio de proyecto o tarea');
    await wait("document.body.textContent.includes('Completa o cancela las tareas pendientes')", 'project_close_blocked'); await click('Volver sin cambios');
    await click('Iniciar tarea'); await click('Confirmar cambio de proyecto o tarea'); await wait("document.body.textContent.includes('Estado: En curso')", 'task_started');
    await click('Completar tarea'); await click('Confirmar cambio de proyecto o tarea'); await wait("document.body.textContent.includes('Estado: Completada')", 'task_completed');
    await click('Finalizar proyecto'); await click('Confirmar cambio de proyecto o tarea'); await wait("document.body.textContent.includes('Estado: Terminado')", 'project_completed');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_finance');
    await click('Finanzas'); await click('Nueva caja o banco');
    await fillLabels({ 'Código de cuenta': 'UI100', 'Nombre de caja o banco': 'Caja UI' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('Registro guardado y saldos actualizados')", 'cash_account_created');
    await click('Registrar movimiento'); await click('Seleccionar caja o banco'); await click('Caja UI · UI100');
    await fillLabels({ 'Importe del movimiento': '25', 'Motivo del movimiento': 'Ingreso sintético UI' }); await click('Guardar cambios');
    await wait("document.body.textContent.includes('Ingreso sintético UI')", 'cash_movement_created');
    const cash = await require('../src/modules/finance/account.model').findOne({ companyId: company._id, code: 'UI100' }); if(cash.balance !== 25) throw new Error('UI_FINANCE_BALANCE');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'dashboard_before_settings');
    await click('Configuración'); await wait("document.body.textContent.includes('Revisar y guardar configuración')", 'settings_loaded');
    await click('Personal'); await click('Revisar y guardar configuración'); await click('Confirmar configuración de módulos');
    await wait("document.body.textContent.includes('Configuración guardada')", 'settings_saved');
    await click('Volver'); await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner') && !document.body.textContent.includes('RRHH')", 'module_hidden');
    await click('Configuración'); await wait("document.body.textContent.includes('Revisar y guardar configuración')", 'settings_reloaded');
    await click('Personal'); await click('Revisar y guardar configuración'); await click('Confirmar configuración de módulos');
    await wait("document.body.textContent.includes('Configuración guardada')", 'module_reenabled');
    await click('Volver'); await send('Page.reload');
    await wait("document.body.textContent.includes('Bienvenido, Synthetic Owner')", 'session_reload');
    await click('Ventas'); await click('Facturas');
    await wait("document.body.textContent.includes('FAC-000001')", 'invoice_persisted');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(500);
    await wait("document.documentElement.scrollWidth <= 392 && document.body.textContent.includes('FAC-000001')", 'mobile_invoice_layout');
    const mobileShot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('C:/proyectoERP/.local/operations-mobile-qa.png', Buffer.from(mobileShot.result.data, 'base64'));
    await send('Emulation.clearDeviceMetricsOverride');
    if (transportFailure) throw new Error('TRANSPORT_FAILURE');
    fs.writeFileSync('C:/proyectoERP/.local/operations-browser-qa.json', JSON.stringify({ environment: 'isolated temporary MongoDB, intercepted Render transport; no production test', steps, requests },null,2));
    console.log(JSON.stringify({ passed: steps }));
  } finally {
    if (ws) ws.close();
    if (webServer) { webServer.closeAllConnections(); await new Promise(r => webServer.close(r)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(r => apiServer.close(r)); }
    await mongoose.disconnect(); if (db) await db.stop();
    delete process.env.INITIAL_SETUP_TOKEN;
  }
})().catch(error => { console.error(/^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'BROWSER_QA_FAILED'); process.exitCode = 1; });

