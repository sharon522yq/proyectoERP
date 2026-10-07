const mongoose = require('mongoose');

const salesOrderSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  folio: { type: String, required: true, trim: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    description: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    subtotal: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  discountTotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'MXN', maxlength: 3 },
  status: { type: String, enum: ['DRAFT', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'], default: 'DRAFT', index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'sales_orders' });

salesOrderSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.SalesOrder || mongoose.model('SalesOrder', salesOrderSchema);
