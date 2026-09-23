const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  taxId: { type: String, trim: true },
  email: { type: String, trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: 'companies' });

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
