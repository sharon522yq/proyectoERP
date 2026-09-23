const mongoose = require('mongoose');

const productionOrderSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  folio: { type: String, required: true, trim: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  bomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bom', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  quantity: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
    index: true
  },
  plannedStartDate: { type: Date },
  plannedEndDate: { type: Date },
  actualStartDate: { type: Date },
  actualEndDate: { type: Date },
  materialCost: { type: Number, min: 0, default: 0 },
  laborCost: { type: Number, min: 0, default: 0 },
  overheadCost: { type: Number, min: 0, default: 0 },
  totalCost: { type: Number, min: 0, default: 0 },
  unitCost: { type: Number, min: 0, default: 0 },
  notes: { type: String, trim: true, maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'production_orders' });

productionOrderSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.ProductionOrder || mongoose.model('ProductionOrder', productionOrderSchema);
