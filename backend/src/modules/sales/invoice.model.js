const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  issuerName: String,
  customerName: String,
  folio: { type: String, required: true, trim: true },
  salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder' },
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
  status: { type: String, enum: ['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'CANCELLED', 'OVERDUE'], default: 'DRAFT', index: true },
  dueDate: { type: Date },
  paidAmount: { type: Number, default: 0, min: 0 },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'invoices' });

invoiceSchema.index({ companyId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ companyId: 1, customerId: 1 });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
