const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employeeId: { type: String, required: true, trim: true, maxlength: 20 },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true, maxlength: 30 },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
  position: { type: String, trim: true, maxlength: 100 },
  hireDate: { type: Date },
  salary: { type: Number, min: 0 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'TERMINATED'], default: 'ACTIVE', index: true }
}, { timestamps: true, collection: 'employees' });

employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
