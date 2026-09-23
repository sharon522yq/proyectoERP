const { asyncHandler } = require('../../utils/ApiError');
const leadService = require('./lead.service');
const customerService = require('./customer.service');
const contactService = require('./contact.service');
const activityService = require('./activity.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, branchId: req.body?.branchId || null, ip: req.ip });

// Leads
const createLead = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await leadService.create(req.body, ctx(req)) }); });
const listLeads = asyncHandler(async (req, res) => { res.json({ success: true, data: await leadService.list(ctx(req), req.query) }); });
const getLead = asyncHandler(async (req, res) => { res.json({ success: true, data: await leadService.getById(req.params.id, ctx(req)) }); });
const updateLead = asyncHandler(async (req, res) => { res.json({ success: true, data: await leadService.update(req.params.id, req.body, ctx(req)) }); });
const deleteLead = asyncHandler(async (req, res) => { res.json({ success: true, data: await leadService.remove(req.params.id, ctx(req)) }); });
const convertLead = asyncHandler(async (req, res) => { res.json({ success: true, data: await leadService.convertToCustomer(req.params.id, ctx(req)) }); });

// Customers
const createCustomer = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await customerService.create(req.body, ctx(req)) }); });
const listCustomers = asyncHandler(async (req, res) => { res.json({ success: true, data: await customerService.list(ctx(req), req.query) }); });
const getCustomer = asyncHandler(async (req, res) => { res.json({ success: true, data: await customerService.getById(req.params.id, ctx(req)) }); });
const updateCustomer = asyncHandler(async (req, res) => { res.json({ success: true, data: await customerService.update(req.params.id, req.body, ctx(req)) }); });
const deleteCustomer = asyncHandler(async (req, res) => { res.json({ success: true, data: await customerService.remove(req.params.id, ctx(req)) }); });

// Contacts
const createContact = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await contactService.create(req.params.customerId, req.body, ctx(req)) }); });
const listContacts = asyncHandler(async (req, res) => { res.json({ success: true, data: await contactService.listByCustomer(req.params.customerId, ctx(req), req.query) }); });
const getContact = asyncHandler(async (req, res) => { res.json({ success: true, data: await contactService.getById(req.params.id, ctx(req)) }); });
const updateContact = asyncHandler(async (req, res) => { res.json({ success: true, data: await contactService.update(req.params.id, req.body, ctx(req)) }); });
const deleteContact = asyncHandler(async (req, res) => { res.json({ success: true, data: await contactService.remove(req.params.id, ctx(req)) }); });

// Activities
const createActivity = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await activityService.create(req.body, ctx(req)) }); });
const listActivities = asyncHandler(async (req, res) => { res.json({ success: true, data: await activityService.list(ctx(req), req.query) }); });
const getActivity = asyncHandler(async (req, res) => { res.json({ success: true, data: await activityService.getById(req.params.id, ctx(req)) }); });
const updateActivity = asyncHandler(async (req, res) => { res.json({ success: true, data: await activityService.update(req.params.id, req.body, ctx(req)) }); });
const deleteActivity = asyncHandler(async (req, res) => { res.json({ success: true, data: await activityService.remove(req.params.id, ctx(req)) }); });

module.exports = {
  createLead, listLeads, getLead, updateLead, deleteLead, convertLead,
  createCustomer, listCustomers, getCustomer, updateCustomer, deleteCustomer,
  createContact, listContacts, getContact, updateContact, deleteContact,
  createActivity, listActivities, getActivity, updateActivity, deleteActivity
};
