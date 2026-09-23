const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 300 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  active: { type: Boolean, default: true },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'categories' });

categorySchema.index({ companyId: 1, name: 1 }, { unique: true });
categorySchema.index({ companyId: 1, parentId: 1 });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
