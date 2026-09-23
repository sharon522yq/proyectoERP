// Adapter determinista SIN red ni claves: default para tests, CI y desarrollo.
// Flujo idéntico al proveedor real (selección de tool → datos → síntesis), de modo que
// los tests ejercitan la tubería completa (permisos, companyId, validación, auditoría)
// sin costo ni dependencia de un proveedor externo.
//
// Hooks de prueba (solo con AI_PROVIDER=mock; el servicio mantiene siempre los cortes
// de permisos y validación, por lo que no amplían privilegios):
//   FORCE_TOOL:<nombre>[:{"param":valor}]  → pide esa tool (para probar rechazo 403)
//   FORCE_INVALID_JSON                     → respuesta no parseable (retry → 502)
//   FORCE_MALFORMED                        → JSON con forma inválida (retry → 502)
//   FORCE_ERROR                            → error del proveedor (502)
//   FORCE_TIMEOUT                          → demora más allá de AI_TIMEOUT_MS (504)

const LABELS = {
  getSalesSummary: 'ventas',
  getPendingOrders: 'pedidos pendientes',
  getInventoryStatus: 'inventario',
  getLowStockProducts: 'productos con stock bajo',
  getCustomerBalance: 'saldo de clientes',
  getAccountsReceivable: 'cuentas por cobrar',
  getAccountsPayable: 'cuentas por pagar',
  getProductionSummary: 'producción',
  getProjectSummary: 'proyectos',
  getCRMOverview: 'CRM',
  getHRHeadcount: 'recursos humanos'
};

const RULES = [
  [/stock bajo|inventario bajo|poco stock|bajo de stock|reponer|producto.*menor|menor.*inventario/, 'getLowStockProducts'],
  [/vend|factur|venta|sales|ingres/, 'getSalesSummary'],
  [/cobrar|cuentas por cobrar|\bcxc\b|saldo.*cliente|cliente.*saldo/, 'getCustomerBalance'],
  [/pagar|cuentas por pagar|\bcxp\b/, 'getAccountsPayable'],
  [/pedido|orden|\border\b/, 'getPendingOrders'],
  [/fabric|producci|production/, 'getProductionSummary'],
  [/proyecto|project|tarea/, 'getProjectSummary'],
  [/\bcrm\b|lead|oportunidad/, 'getCRMOverview'],
  [/empleado|rrhh|nomina|plantilla|capital humano/, 'getHRHeadcount'],
  [/activo|pasivo|finanz|contable|resultado/, 'getAccountsReceivable'],
  [/inventario|stock|existencia/, 'getInventoryStatus']
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function sleep(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (t.unref) t.unref();
  });
}

function estimateTokens(s) {
  return Math.max(1, Math.ceil(String(s || '').length / 4));
}

function lastUserContent(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || '';
  }
  return '';
}

function toolDataContent(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (String(messages[i].content || '').startsWith('DATOS_AUTORIZADOS:')) return messages[i].content;
  }
  return null;
}

class MockProvider {
  constructor(cfg) {
    this.name = 'mock';
    this.cfg = cfg;
    this.model = 'mock-v1';
  }

  async _applyForces(content) {
    if (/FORCE_ERROR/i.test(content)) throw new Error('mock: fallo simulado del proveedor');
    if (/FORCE_TIMEOUT/i.test(content)) await sleep(3000);
  }

  _forceTool(content) {
    const m = content.match(/force_tool:([a-z_]+)(?::(\{.*?\}))?/i);
    if (!m) return null;
    let params = {};
    if (m[2]) { try { params = JSON.parse(m[2]); } catch { params = {}; } }
    return { tool: m[1], params, directAnswer: '' };
  }

  async generateText(messages, opts = {}) {
    const userMsg = lastUserContent(messages);
    await this._applyForces(userMsg);
    const dataMsg = toolDataContent(messages);
    let text;
    if (dataMsg) {
      const payload = dataMsg.slice('DATOS_AUTORIZADOS:'.length).trim();
      try {
        const { tool, data } = JSON.parse(payload);
        const label = LABELS[tool] || tool;
        if (data === null || data === undefined || (typeof data === 'object' && Object.keys(data).length === 0)) {
          text = `No hay datos disponibles de ${label} para responder.`;
        } else {
          const lines = Object.entries(data).map(([k, v]) =>
            `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
          text = `Según los datos autorizados de ${label}:\n${lines.join('\n')}`;
        }
      } catch {
        text = 'No dispongo de datos suficientes para responder a esa pregunta.';
      }
    } else {
      text = 'No dispongo de datos suficientes para responder a esa pregunta.';
    }
    return { text, tokensIn: estimateTokens(messages.map((m) => m.content).join(' ')), tokensOut: estimateTokens(text), latencyMs: 5 };
  }

  async generateStructured(messages, schemaHint = {}, opts = {}) {
    const content = lastUserContent(messages);
    await this._applyForces(content);
    const base = {
      tokensIn: estimateTokens(content),
      tokensOut: 40,
      latencyMs: 5,
      raw: ''
    };

    if (/FORCE_INVALID_JSON/i.test(content)) {
      return { ...base, data: null, raw: '{esto no es JSON válido' };
    }

    if (schemaHint.name === 'analysis') {
      if (/FORCE_MALFORMED/i.test(content)) {
        const bad = { type: 'wrong', summary: 123 };
        return { ...base, data: bad, raw: JSON.stringify(bad) };
      }
      const dataMsg = toolDataContent(messages);
      let sources = {};
      try { sources = dataMsg ? JSON.parse(dataMsg.slice('DATOS_AUTORIZADOS:'.length)) : {}; } catch { sources = {}; }
      const findings = [];
      const recommendations = [];
      const s = sources.getInventoryStatus || {};
      if (s.lowStockCount > 0) {
        findings.push(`${s.lowStockCount} productos por debajo del stock mínimo.`);
        recommendations.push('Revisar niveles de inventario y considerar órdenes de compra.');
      }
      const sales = sources.getSalesSummary || {};
      if (sales.pendingInvoices > 0) {
        findings.push(`${sales.pendingInvoices} facturas pendientes por cobrar.`);
        recommendations.push('Gestionar el cobro de facturas pendientes.');
      }
      if (Number(sales.accountsReceivable) > 0) {
        findings.push(`Cuentas por cobrar: ${sales.accountsReceivable}.`);
      }
      const prod = sources.getProductionSummary || {};
      if (prod.inProgress > 0) findings.push(`${prod.inProgress} órdenes de producción en curso.`);
      const projects = sources.getProjectSummary || {};
      if (projects.pendingTasks > 0) {
        findings.push(`${projects.pendingTasks} tareas de proyecto pendientes.`);
        recommendations.push('Priorizar tareas vencidas o en riesgo.');
      }
      const crm = sources.getCRMOverview || {};
      if (crm.newLeads > 0) findings.push(`${crm.newLeads} leads nuevos sin calificar.`);
      if (findings.length === 0) findings.push('No se detectaron hallazgos relevantes con los datos disponibles.');
      const summary = findings.join(' ');
      const data = { type: 'analysis', summary, findings, recommendations, confidence: null };
      return { ...base, tokensOut: estimateTokens(summary), data, raw: JSON.stringify(data) };
    }

    // chatSelection
    const forced = this._forceTool(content);
    if (forced) return { ...base, data: forced, raw: JSON.stringify(forced) };

    const n = norm(content);
    for (const [re, tool] of RULES) {
      if (re.test(n)) {
        const data = { tool, params: {}, directAnswer: '' };
        return { ...base, data, raw: JSON.stringify(data) };
      }
    }
    if (/^(hola|buenas|hi|hello|gracias|thank|ayuda|help)/.test(n.trim())) {
      const data = {
        tool: null,
        params: {},
        directAnswer: '¡Hola! Soy el asistente del ERP. Puedo consultar ventas, inventario, cuentas por cobrar/pagar, pedidos, producción, proyectos, CRM y personal (según tus permisos).'
      };
      return { ...base, data, raw: JSON.stringify(data) };
    }
    const data = { tool: null, params: {}, directAnswer: '' };
    return { ...base, data, raw: JSON.stringify(data) };
  }

  async analyze(prompt, opts = {}) {
    return this.generateStructured([{ role: 'user', content: prompt }], { name: 'analysis' }, opts);
  }

  async healthCheck() {
    return { ok: true, provider: 'mock', model: 'mock-v1', detail: 'Proveedor determinista local (sin claves)' };
  }
}

module.exports = MockProvider;
