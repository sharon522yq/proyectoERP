const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  type: { type: String, enum: ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'TASK', 'FOLLOW_UP'], required: true },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  date: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  outcome: { type: String, trim: true, maxlength: 500 },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'activities' });

activitySchema.index({ companyId: 1, date: -1 });
activitySchema.index({ companyId: 1, assignedTo: 1, status: 1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
