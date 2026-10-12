const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  mode: { type: String, enum: ['development_fixture', 'internal'], required: true },
  modules: { type: [String], required: true },
  expiresAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
  reason: { type: String, required: true },
  issuedBy: { type: String, enum: ['private-first-access'], required: true }
}, { timestamps: true });
module.exports = mongoose.models.AccessGrant || mongoose.model('AccessGrant', schema);
