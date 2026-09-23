// Registro de tools ERP autorizadas para la IA (ETAPA 7) — SOLO LECTURA.
// Cada tool:
//   1. valida el permiso RBAC del usuario (requiredPermission),
//   2. obtiene companyId EXCLUSIVAMENTE del contexto autenticado (nunca del body/modelo),
//   3. valida y acota sus parámetros (sin claves arbitrarias: defensa IDOR),
//   4. ejecuta la consulta y devuelve solo los datos necesarios (salida acotada).
// No existen tools de escritura en FASE 12: ninguna acción crítica sin humano.

const { hasPermission } = require('../../middlewares/auth');
const { ApiError } = require('../../utils/ApiError');
const dashboard = require('../dashboard/dashboard.service');

function periodRange(period) {
  const now = new Date();
  let start;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'quarter':
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
      return {};
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1); // month
  }
  return { startDate: start.toISOString() };
}

// Parámetros estrictos: claves desconocidas se rechazan (no se filtran a las queries)
function validateParams(spec, params) {
  const errors = [];
  const out = {};
  const given = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  for (const key of Object.keys(given)) {
    if (!spec[key]) errors.push(`parámetro no permitido: ${key}`);
  }
  for (const [key, def] of Object.entries(spec)) {
    const value = given[key];
    if (value === undefined || value === null) {
      if (def.default !== undefined) out[key] = def.default;
      continue;
    }
    if (def.type === 'int') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < def.min || n > def.max) errors.push(`${key} debe ser entero entre ${def.min} y ${def.max}`);
      else out[key] = n;
    } else if (def.type === 'enum') {
      if (!def.values.includes(value)) errors.push(`${key} debe ser uno de ${def.values.join(', ')}`);
      else out[key] = value;
    } else if (def.type === 'string') {
      if (typeof value !== 'string' || value.length > (def.max || 200)) errors.push(`${key} inválido`);
      else out[key] = value;
    }
  }
  if (errors.length) throw new ApiError(400, `Parámetros de herramienta inválidos: ${errors.join('; ')}`, 'AI_TOOL_PARAMS');
  return out;
}

const TOOLS = {
  getSalesSummary: {
    description: 'Resumen de ventas (facturado, cobrado, pendiente) de un periodo',
    requiredPermission: 'sales.invoices.read',
    paramsHint: 'period: today|month|quarter|year|all (default month)',
    params: { period: { type: 'enum', values: ['today', 'month', 'quarter', 'year', 'all'], default: 'month' } },
    handler: (companyId, p) => dashboard.getSalesSummary(companyId, periodRange(p.period))
  },
  getPendingOrders: {
    description: 'Órdenes de venta pendientes (CONFIRMED/PREPARING)',
    requiredPermission: 'sales.orders.read',
    paramsHint: 'top: 1-50 (default 10)',
    params: { top: { type: 'int', min: 1, max: 50, default: 10 } },
    handler: async (companyId, p) => {
      const SalesOrder = require('../sales/salesOrder.model');
      const docs = await SalesOrder.find({ companyId, status: { $in: ['CONFIRMED', 'PREPARING'] } })
        .sort({ createdAt: -1 }).limit(p.top).lean();
      return docs.map((d) => ({ _id: d._id, status: d.status, total: d.total, createdAt: d.createdAt }));
    }
  },
  getInventoryStatus: {
    description: 'Estado del inventario (totales, valor de stock, stock bajo)',
    requiredPermission: 'inventory.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: (companyId) => dashboard.getInventorySummary(companyId)
  },
  getLowStockProducts: {
    description: 'Productos por debajo del stock mínimo',
    requiredPermission: 'inventory.read',
    paramsHint: 'top: 1-50 (default 10)',
    params: { top: { type: 'int', min: 1, max: 50, default: 10 } },
    handler: async (companyId, p) => {
      const summary = await dashboard.getInventorySummary(companyId);
      return { lowStockCount: summary.lowStockCount, products: (summary.lowStockProducts || []).slice(0, p.top) };
    }
  },
  getAccountsReceivable: {
    description: 'Saldo de cuentas por cobrar (cuenta 1200)',
    requiredPermission: 'finance.accounts.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: async (companyId) => {
      const Account = require('../finance/account.model');
      const acc = await Account.findOne({ companyId, code: '1200' }).lean();
      return acc ? { code: acc.code, name: acc.name, balance: acc.balance } : { code: '1200', balance: 0, note: 'cuenta no creada' };
    }
  },
  getAccountsPayable: {
    description: 'Saldo de cuentas por pagar (cuenta 2100)',
    requiredPermission: 'finance.accounts.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: async (companyId) => {
      const Account = require('../finance/account.model');
      const acc = await Account.findOne({ companyId, code: '2100' }).lean();
      return acc ? { code: acc.code, name: acc.name, balance: acc.balance } : { code: '2100', balance: 0, note: 'cuenta no creada' };
    }
  },
  getCustomerBalance: {
    description: 'Clientes con mayor saldo pendiente (facturado - pagado)',
    requiredPermission: 'sales.invoices.read',
    paramsHint: 'top: 1-50 (default 10)',
    params: { top: { type: 'int', min: 1, max: 50, default: 10 } },
    handler: async (companyId, p) => {
      const Invoice = require('../sales/invoice.model');
      const mongoose = require('mongoose');
      const rows = await Invoice.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), deletedAt: null } },
        { $group: { _id: '$customerId', totalBilled: { $sum: '$total' }, totalPaid: { $sum: '$paidAmount' }, invoices: { $sum: 1 } } },
        { $addFields: { balance: { $subtract: ['$totalBilled', '$totalPaid'] } } },
        { $match: { balance: { $gt: 0 } } },
        { $sort: { balance: -1 } },
        { $limit: p.top },
        { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
        { $project: { customerId: '$_id', name: { $arrayElemAt: ['$customer.name', 0] }, totalBilled: 1, totalPaid: 1, balance: 1, _id: 0 } }
      ]);
      return rows;
    }
  },
  getProductionSummary: {
    description: 'Órdenes de producción por estado',
    requiredPermission: 'production.orders.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: (companyId) => dashboard.getProductionSummary(companyId)
  },
  getProjectSummary: {
    description: 'Resumen de proyectos y tareas',
    requiredPermission: 'projects.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: (companyId) => dashboard.getProjectSummary(companyId)
  },
  getCRMOverview: {
    description: 'Resumen de CRM (leads y clientes)',
    requiredPermission: 'crm.leads.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: (companyId) => dashboard.getCRMSummary(companyId)
  },
  getHRHeadcount: {
    description: 'Solo conteos de personal (sin datos personales)',
    requiredPermission: 'hr.employees.read',
    paramsHint: 'sin parámetros',
    params: {},
    handler: (companyId) => dashboard.getHRSummary(companyId)
  }
};

// Whitelist de tools disponibles para los permisos del usuario
function allowedToolsFor(permissions) {
  return Object.entries(TOOLS)
    .filter(([, def]) => hasPermission(permissions, def.requiredPermission))
    .map(([name, def]) => ({ name, description: def.description, paramsHint: def.paramsHint, requiredPermission: def.requiredPermission }));
}

// Ejecuta una tool validando whitelist + permiso + parámetros + companyId del contexto
async function executeTool(name, params, ctx) {
  const def = TOOLS[name];
  if (!def || !hasPermission(ctx.permissions, def.requiredPermission)) {
    throw new ApiError(403, 'Herramienta IA no autorizada para este usuario', 'AI_UNAUTHORIZED_TOOL');
  }
  const cleaned = validateParams(def.params, params);
  return def.handler(ctx.companyId, cleaned, ctx);
}

module.exports = { TOOLS, allowedToolsFor, executeTool, validateParams, periodRange };
