const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 300 },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: 'departments' });

departmentSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
