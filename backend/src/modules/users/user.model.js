const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, uppercase: true, trim: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  active: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0, select: false },
  refreshTokenHash: { type: String, select: false },
  resetTokenHash: { type: String, select: false },
  resetExpires: { type: Date, select: false }
}, { timestamps: true, collection: 'users' });

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.sessionVersion;
  delete obj.passwordHash;
  delete obj.refreshTokenHash;
  delete obj.resetTokenHash;
  delete obj.resetExpires;
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
