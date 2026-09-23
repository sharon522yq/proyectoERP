const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./dashboard.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

const getDashboard = asyncHandler(async (req, res) => {
  const c = ctx(req);
  const [sales, inventory, finance, production, projects, crm, hr] = await Promise.all([
    svc.getSalesSummary(c.companyId, req.query),
    svc.getInventorySummary(c.companyId),
    svc.getFinanceSummary(c.companyId),
    svc.getProductionSummary(c.companyId),
    svc.getProjectSummary(c.companyId),
    svc.getCRMSummary(c.companyId),
    svc.getHRSummary(c.companyId)
  ]);
  res.json({ success: true, data: { sales, inventory, finance, production, projects, crm, hr } });
});

const getSalesReport = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getSalesReport(req.companyId, req.query) }); });
const getInventoryReport = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getInventoryReport(req.companyId, req.query) }); });
const getSalesSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getSalesSummary(req.companyId, req.query) }); });
const getInventorySummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getInventorySummary(req.companyId) }); });
const getFinanceSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getFinanceSummary(req.companyId) }); });
const getProductionSummary = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getProductionSummary(req.companyId) }); });

module.exports = { getDashboard, getSalesReport, getInventoryReport, getSalesSummary, getInventorySummary, getFinanceSummary, getProductionSummary };
