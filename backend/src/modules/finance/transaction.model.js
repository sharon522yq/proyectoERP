const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  requestId: { type: String, maxlength: 80 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  type: { type: String, enum: ['INCOME', 'EXPENSE', 'TRANSFER'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, trim: true, maxlength: 500 },
  referenceType: { type: String, trim: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  category: { type: String, trim: true, maxlength: 100 },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, collection: 'transactions' });

transactionSchema.index({ companyId: 1, date: -1 });
transactionSchema.index({ companyId: 1, accountId: 1 });

transactionSchema.index({ companyId: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
