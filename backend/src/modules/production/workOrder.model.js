const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productionOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 500 },
  sequence: { type: Number, required: true, min: 1 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'PENDING', index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  notes: { type: String, trim: true, maxlength: 500 }
}, { timestamps: true, collection: 'work_orders' });

workOrderSchema.index({ companyId: 1, productionOrderId: 1, sequence: 1 });

module.exports = mongoose.models.WorkOrder || mongoose.model('WorkOrder', workOrderSchema);
