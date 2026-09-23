const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  type: {
    type: String,
    enum: ['PURCHASE_ENTRY', 'SALE_EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'INITIAL_STOCK'],
    required: true,
    index: true
  },
  quantity: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  reason: { type: String, trim: true, maxlength: 500 },
  referenceType: { type: String, trim: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }
}, { timestamps: true, collection: 'inventory_movements' });

movementSchema.index({ companyId: 1, createdAt: -1 });
movementSchema.index({ companyId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', movementSchema);
