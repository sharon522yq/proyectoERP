const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true, maxlength: 30 },
  company: { type: String, trim: true, maxlength: 150 },
  source: { type: String, enum: ['WEB', 'PHONE', 'EMAIL', 'REFERRAL', 'SOCIAL', 'EVENT', 'OTHER'], default: 'OTHER' },
  status: { type: String, enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'], default: 'NEW' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true, maxlength: 2000 },
  estimatedValue: { type: Number, min: 0 },
  convertedAt: { type: Date },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'leads' });

leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ companyId: 1, assignedTo: 1 });

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
