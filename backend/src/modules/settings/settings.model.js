const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  key: { type: String, required: true },
  value: { type: Object }
}, { timestamps: true, collection: 'system_settings' });

settingsSchema.index({ companyId: 1, key: 1 }, { unique: true });

module.exports = mongoose.models.SystemSetting || mongoose.model('SystemSetting', settingsSchema);
