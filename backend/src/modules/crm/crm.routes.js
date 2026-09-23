const { Router } = require('express');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const v = require('./crm.validation');
const ctrl = require('./crm.controller');

const router = Router();
router.use(authenticate, scopeCompany);

// Leads
router.get('/leads', requirePermission('crm.leads.read'), ctrl.listLeads);
router.post('/leads', requirePermission('crm.leads.create'), v.createLead, validate, ctrl.createLead);
router.get('/leads/:id', requirePermission('crm.leads.read'), v.idParam, validate, ctrl.getLead);
router.put('/leads/:id', requirePermission('crm.leads.update'), v.updateLead, validate, ctrl.updateLead);
router.delete('/leads/:id', requirePermission('crm.leads.delete'), v.idParam, validate, ctrl.deleteLead);
router.post('/leads/:id/convert', requirePermission('crm.leads.update'), v.idParam, validate, ctrl.convertLead);

// Customers
router.get('/customers', requirePermission('crm.customers.read'), ctrl.listCustomers);
router.post('/customers', requirePermission('crm.customers.create'), v.createCustomer, validate, ctrl.createCustomer);
router.get('/customers/:id', requirePermission('crm.customers.read'), v.idParam, validate, ctrl.getCustomer);
router.put('/customers/:id', requirePermission('crm.customers.update'), v.updateCustomer, validate, ctrl.updateCustomer);
router.delete('/customers/:id', requirePermission('crm.customers.delete'), v.idParam, validate, ctrl.deleteCustomer);

// Contacts (nested under customers)
router.get('/customers/:customerId/contacts', requirePermission('crm.contacts.read'), ctrl.listContacts);
router.post('/customers/:customerId/contacts', requirePermission('crm.contacts.create'), v.createContact, validate, ctrl.createContact);
router.get('/contacts/:id', requirePermission('crm.contacts.read'), v.idParam, validate, ctrl.getContact);
router.put('/contacts/:id', requirePermission('crm.contacts.update'), v.updateContact, validate, ctrl.updateContact);
router.delete('/contacts/:id', requirePermission('crm.contacts.delete'), v.idParam, validate, ctrl.deleteContact);

// Activities
router.get('/activities', requirePermission('crm.activities.read'), ctrl.listActivities);
router.post('/activities', requirePermission('crm.activities.create'), v.createActivity, validate, ctrl.createActivity);
router.get('/activities/:id', requirePermission('crm.activities.read'), v.idParam, validate, ctrl.getActivity);
router.put('/activities/:id', requirePermission('crm.activities.update'), v.updateActivity, validate, ctrl.updateActivity);
router.delete('/activities/:id', requirePermission('crm.activities.delete'), v.idParam, validate, ctrl.deleteActivity);

module.exports = router;
