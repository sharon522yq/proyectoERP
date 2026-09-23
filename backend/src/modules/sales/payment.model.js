const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  folio: { type: String, required: true, trim: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER'], required: true },
  reference: { type: String, trim: true, maxlength: 100 },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'REJECTED'], default: 'PENDING', index: true },
  paidAt: { type: Date, default: Date.now },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, collection: 'payments' });

paymentSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
