const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  code: { type: String, required: true, trim: true, maxlength: 20 },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  type: { type: String, enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'], required: true, index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  balance: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: 'accounts' });

accountSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = mongoose.models.Account || mongoose.model('Account', accountSchema);
