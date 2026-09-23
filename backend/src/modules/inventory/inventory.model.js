const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  reservedQty: { type: Number, min: 0, default: 0 },
  lastMovementAt: { type: Date }
}, { timestamps: true, collection: 'inventory' });

inventorySchema.index({ companyId: 1, warehouseId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
