const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  action: { type: String, enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT'], required: true },
  module: { type: String, required: true },
  documentId: { type: String },
  previousData: { type: Object },
  newData: { type: Object },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'audit_logs' });

auditSchema.index({ companyId: 1, timestamp: -1 });
auditSchema.index({ module: 1, timestamp: -1 });

module.exports = mongoose.models.Audit || mongoose.model('Audit', auditSchema);
