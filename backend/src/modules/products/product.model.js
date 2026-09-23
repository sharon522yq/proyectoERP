const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  sku: { type: String, required: true, trim: true, maxlength: 50 },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000 },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
  cost: { type: Number, min: 0, default: 0 },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'MXN', maxlength: 3 },
  taxRate: { type: Number, min: 0, max: 100, default: 0 },
  minimumStock: { type: Number, min: 0, default: 0 },
  maximumStock: { type: Number, min: 0 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'], default: 'ACTIVE' },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'products' });

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, name: 'text', description: 'text' });
productSchema.index({ companyId: 1, categoryId: 1 });
productSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
