const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true, maxlength: 30 },
  position: { type: String, trim: true, maxlength: 100 },
  isPrimary: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'contacts' });

contactSchema.index({ companyId: 1, customerId: 1 });

module.exports = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
