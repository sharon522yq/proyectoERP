const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  folio: { type: String, required: true, trim: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    description: String,
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  taxTotal: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'MXN', maxlength: 3 },
  status: { type: String, enum: ['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED'], default: 'DRAFT', index: true },
  notes: { type: String, trim: true, maxlength: 2000 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'purchase_orders' });

purchaseOrderSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
