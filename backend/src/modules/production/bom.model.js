const mongoose = require('mongoose');

const bomItemSchema = new mongoose.Schema({
  componentProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.001 },
  unitCost: { type: Number, min: 0, default: 0 }
}, { _id: false });

const bomSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 500 },
  items: { type: [bomItemSchema], required: true, validate: v => v.length > 0 },
  totalMaterialCost: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'boms' });

bomSchema.index({ companyId: 1, productId: 1 });

module.exports = mongoose.models.Bom || mongoose.model('Bom', bomSchema);
