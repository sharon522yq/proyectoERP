const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true, maxlength: 30 },
  address: { type: String, trim: true, maxlength: 300 },
  taxId: { type: String, trim: true, maxlength: 40 },
  type: { type: String, enum: ['INDIVIDUAL', 'BUSINESS'], default: 'INDIVIDUAL' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'], default: 'ACTIVE' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  notes: { type: String, trim: true, maxlength: 2000 },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'customers' });

customerSchema.index({ companyId: 1, status: 1 });
customerSchema.index({ companyId: 1, assignedTo: 1 });
customerSchema.index({ companyId: 1, name: 'text', email: 'text' });

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
