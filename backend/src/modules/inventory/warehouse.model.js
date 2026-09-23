const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  code: { type: String, required: true, trim: true, maxlength: 20 },
  address: { type: String, trim: true, maxlength: 300 },
  responsible: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active: { type: Boolean, default: true },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'warehouses' });

warehouseSchema.index({ companyId: 1, code: 1 }, { unique: true });
warehouseSchema.index({ companyId: 1, active: 1 });

module.exports = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
