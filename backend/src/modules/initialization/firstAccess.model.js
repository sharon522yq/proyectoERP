const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, default: 'first-owner' },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  target: { type: String, enum: ['development', 'production'], required: true },
  companyName: { type: String, required: true },
  grantMode: { type: String, required: true },
  fixturesSeededAt: Date
}, { timestamps: true });
module.exports = mongoose.models.FirstAccess || mongoose.model('FirstAccess', schema);
