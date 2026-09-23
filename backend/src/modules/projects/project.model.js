const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'], default: 'PLANNING', index: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startDate: { type: Date },
  endDate: { type: Date },
  budget: { type: Number, min: 0, default: 0 },
  progress: { type: Number, min: 0, max: 100, default: 0 }
}, { timestamps: true, collection: 'projects' });

projectSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
