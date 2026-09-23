const mongoose = require('mongoose');

const materialConsumptionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productionOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  quantityRequired: { type: Number, required: true, min: 0 },
  quantityConsumed: { type: Number, required: true, min: 0, default: 0 },
  unitCost: { type: Number, min: 0, default: 0 },
  totalCost: { type: Number, min: 0, default: 0 },
  inventoryMovementId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryMovement' },
  status: { type: String, enum: ['PENDING', 'PARTIAL', 'COMPLETED'], default: 'PENDING' },
  consumedAt: { type: Date },
  consumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, collection: 'material_consumptions' });

materialConsumptionSchema.index({ companyId: 1, productionOrderId: 1 });

module.exports = mongoose.models.MaterialConsumption || mongoose.model('MaterialConsumption', materialConsumptionSchema);
