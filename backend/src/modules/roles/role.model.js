const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, uppercase: true, trim: true },
  permissions: { type: [String], default: [] },
  isSystem: { type: Boolean, default: false }
}, { timestamps: true, collection: 'roles' });

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
