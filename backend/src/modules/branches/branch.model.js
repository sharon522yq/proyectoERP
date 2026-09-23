const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: 'branches' });

module.exports = mongoose.models.Branch || mongoose.model('Branch', branchSchema);
