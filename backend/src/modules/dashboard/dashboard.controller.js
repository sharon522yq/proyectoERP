const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./dashboard.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

const getDashboard = asyncHandler(async (req, res) => {
  const c = ctx(req);
  const { hasPermission } = require('../../middlewares/auth');
  const specs = [
    ['sales', 'sales.invoices.read', () => svc.getSalesSummary(c.companyId, req.query)],
    ['inventory', 'inventory.read', () => svc.getInventorySummary(c.companyId)],
    ['finance', 'finance.accounts.read', () => svc.getFinanceSummary(c.companyId)],
    ['production', 'production.orders.read', () => svc.getProductionSummary(c.companyId)],
    ['projects', 'projects.read', () => svc.getProjectSummary(c.companyId)],
    ['crm', 'crm.leads.read', () => svc.getCRMSummary(c.companyId)],
    ['hr', 'hr.employees.read', () => svc.getHRSummary(c.companyId)]
  ];
  const enabledModules = c.companyId ? await require('../../middlewares/modules').enabledModules(c.companyId) : [];
  const optional = require('../../middlewares/modules').OPTIONAL_MODULES;
  const data = c.companyId ? { enabledModules } : {};
  if (c.companyId) {
    for (const [name, permission, load] of specs) {
      if ((!optional.includes(name) || enabledModules.includes(name)) && hasPermission(req.user.permissions, permission)) data[name] = await load();
    }
  }
  res.json({ success: true, data });
});

const getSalesReport = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getSalesReport(req.companyId, req.query) }); });
const getInventoryReport = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getInventoryReport(req.companyId, req.query) }); });
const getSalesSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getSalesSummary(req.companyId, req.query) }); });
const getInventorySummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getInventorySummary(req.companyId) }); });
const getFinanceSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getFinanceSummary(req.companyId) }); });
const getProductionSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getProductionSummary(req.companyId) }); });

module.exports = { getDashboard, getSalesReport, getInventoryReport, getSalesSummary, getInventorySummary, getFinanceSummary, getProductionSummary };
