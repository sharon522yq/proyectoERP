const mongoose = require('mongoose');

// Aggregation helpers for dashboard/reports
async function getSalesSummary(companyId, { startDate, endDate } = {}) {
  const Quote = require('../sales/quote.model');
  const Invoice = require('../sales/invoice.model');
  const Payment = require('../sales/payment.model');

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  // FIX (FASE 12): aggregate NO convierte string → ObjectId; sin este cast los
  // $match nunca coincidían y totalInvoiced/totalPaid siempre devolvían 0.
  const oid = new mongoose.Types.ObjectId(companyId);
  const invoiceFilter = { companyId: oid, deletedAt: null };
  if (startDate || endDate) invoiceFilter.createdAt = dateFilter;

  const paymentFilter = { companyId: oid };
  if (startDate || endDate) paymentFilter.createdAt = dateFilter;

  const [totalInvoices, totalPayments, pendingInvoices] = await Promise.all([
    Invoice.aggregate([
      { $match: invoiceFilter },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    Invoice.countDocuments({ companyId: oid, status: { $in: ['SENT', 'PARTIAL', 'OVERDUE'] }, deletedAt: null })
  ]);

  return {
    totalInvoiced: totalInvoices[0]?.total || 0,
    invoiceCount: totalInvoices[0]?.count || 0,
    totalPaid: totalPayments[0]?.total || 0,
    paymentCount: totalPayments[0]?.count || 0,
    pendingInvoices,
    accountsReceivable: (totalInvoices[0]?.total || 0) - (totalPayments[0]?.total || 0)
  };
}

async function getInventorySummary(companyId) {
  const Inventory = require('../inventory/inventory.model');
  const Product = require('../products/product.model');

  const [lowStockProducts, totalProducts, stockValue] = await Promise.all([
    Product.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'ACTIVE', deletedAt: null } },
      {
        $lookup: {
          from: 'inventory',
          let: { productId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$productId', '$$productId'] }, companyId: new mongoose.Types.ObjectId(companyId) } },
            { $group: { _id: null, totalQty: { $sum: '$quantity' } } }
          ],
          as: 'stock'
        }
      },
      { $unwind: { path: '$stock', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          currentStock: { $ifNull: ['$stock.totalQty', 0] }
        }
      },
      { $match: { $expr: { $lt: ['$currentStock', '$minimumStock'] } } },
      { $project: { name: 1, sku: 1, currentStock: 1, minimumStock: 1 } }
    ]),
    Product.countDocuments({ companyId, status: 'ACTIVE', deletedAt: null }),
    Inventory.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      {
        $lookup: {
          from: 'products',
          let: { productId: '$productId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$productId'] } } },
            { $project: { cost: 1 } }
          ],
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', { $ifNull: ['$product.cost', 0] }] } } } }
    ])
  ]);

  return {
    totalProducts,
    lowStockProducts,
    lowStockCount: lowStockProducts.length,
    stockValue: stockValue[0]?.total || 0
  };
}

async function getFinanceSummary(companyId) {
  const Account = require('../finance/account.model');

  const accounts = await Account.find({ companyId }).lean();
  const assets = accounts.filter(a => a.type === 'ASSET').reduce((s, a) => s + a.balance, 0);
  const liabilities = accounts.filter(a => a.type === 'LIABILITY').reduce((s, a) => s + a.balance, 0);
  const income = accounts.filter(a => a.type === 'INCOME').reduce((s, a) => s + a.balance, 0);
  const expenses = accounts.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0);

  return { assets, liabilities, income, expenses, netIncome: income - expenses };
}

async function getProductionSummary(companyId) {
  const ProductionOrder = require('../production/productionOrder.model');

  const [total, byStatus] = await Promise.all([
    ProductionOrder.countDocuments({ companyId, deletedAt: null }),
    ProductionOrder.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const statusMap = {};
  for (const s of byStatus) statusMap[s._id] = s.count;

  return {
    totalOrders: total,
    draft: statusMap.DRAFT || 0,
    planned: statusMap.PLANNED || 0,
    released: statusMap.RELEASED || 0,
    inProgress: statusMap.IN_PROGRESS || 0,
    completed: statusMap.COMPLETED || 0,
    cancelled: statusMap.CANCELLED || 0
  };
}

async function getProjectSummary(companyId) {
  const Project = require('../projects/project.model');
  const Task = require('../projects/task.model');

  const [totalProjects, activeProjects, totalTasks, pendingTasks] = await Promise.all([
    Project.countDocuments({ companyId }),
    Project.countDocuments({ companyId, status: 'ACTIVE' }),
    Task.countDocuments({ companyId }),
    Task.countDocuments({ companyId, status: { $in: ['TODO', 'IN_PROGRESS'] } })
  ]);

  return { totalProjects, activeProjects, totalTasks, pendingTasks };
}

async function getCRMSummary(companyId) {
  const Lead = require('../crm/lead.model');
  const Customer = require('../crm/customer.model');

  const [totalLeads, newLeads, totalCustomers, activeCustomers] = await Promise.all([
    Lead.countDocuments({ companyId, deletedAt: null }),
    Lead.countDocuments({ companyId, status: 'NEW', deletedAt: null }),
    Customer.countDocuments({ companyId, deletedAt: null }),
    Customer.countDocuments({ companyId, status: 'ACTIVE', deletedAt: null })
  ]);

  return { totalLeads, newLeads, totalCustomers, activeCustomers };
}

async function getHRSummary(companyId) {
  const Employee = require('../hr/employee.model');
  const Department = require('../hr/department.model');

  const [totalEmployees, activeEmployees, totalDepartments] = await Promise.all([
    Employee.countDocuments({ companyId }),
    Employee.countDocuments({ companyId, status: 'ACTIVE' }),
    Department.countDocuments({ companyId })
  ]);

  return { totalEmployees, activeEmployees, totalDepartments };
}

// Report generators
async function getSalesReport(companyId, { startDate, endDate, page = 1, limit = 20 } = {}) {
  const Invoice = require('../sales/invoice.model');
  const filter = { companyId, deletedAt: null };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

async function getInventoryReport(companyId, { warehouseId, page = 1, limit = 20 } = {}) {
  const Inventory = require('../inventory/inventory.model');
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Inventory.find(filter).sort({ quantity: -1 }).skip(skip).limit(limit).lean(),
    Inventory.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

module.exports = {
  getSalesSummary, getInventorySummary, getFinanceSummary, getProductionSummary,
  getProjectSummary, getCRMSummary, getHRSummary,
  getSalesReport, getInventoryReport
};
