const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  symbol: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ['WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'UNIT', 'TIME'], default: 'UNIT' }
}, { timestamps: true, collection: 'units' });

module.exports = mongoose.models.Unit || mongoose.model('Unit', unitSchema);
