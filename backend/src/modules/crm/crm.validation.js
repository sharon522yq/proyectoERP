const { body, param, query } = require('express-validator');

const createLead = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('source').optional().isIn(['WEB', 'PHONE', 'EMAIL', 'REFERRAL', 'SOCIAL', 'EVENT', 'OTHER']),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  body('estimatedValue').optional().isFloat({ min: 0 }),
];
const updateLead = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 }),
  body('status').optional().isIn(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
];
const idParam = [param('id').isMongoId()];

const createCustomer = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('type').optional().isIn(['INDIVIDUAL', 'BUSINESS']),
];
const updateCustomer = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'BLOCKED']),
];

const createContact = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
];
const updateContact = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 }),
];

const createActivity = [
  body('type').isIn(['CALL', 'MEETING', 'EMAIL', 'NOTE', 'TASK', 'FOLLOW_UP']),
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('leadId').optional().isMongoId(),
  body('customerId').optional().isMongoId(),
  body('date').optional().isISO8601(),
  body('dueDate').optional().isISO8601(),
];
const updateActivity = [
  param('id').isMongoId(),
  body('status').optional().isIn(['PENDING', 'COMPLETED', 'CANCELLED']),
];

module.exports = { createLead, updateLead, idParam, createCustomer, updateCustomer, createContact, updateContact, createActivity, updateActivity };
