const User = require('./user.model');

async function create(data) { return User.create(data); }
async function findByEmail(email) { return User.findOne({ email }).select('+passwordHash +refreshTokenHash +sessionVersion'); }
async function findById(id) { return User.findById(id); }
async function findByIdWithSecrets(id) { return User.findById(id).select('+passwordHash +refreshTokenHash +sessionVersion +resetTokenHash +resetExpires'); }
async function listByCompany(companyId) {
  // Aislamiento multiempresa: sin companyId solo se devuelven usuarios sin empresa
  // asignados (nunca el listado completo).
  const filter = companyId ? { companyId } : { companyId: null };
  return User.find(filter).sort({ name: 1 });
}
async function update(id, data) {
  await User.updateOne({ _id: id }, { $set: data });
  return User.findById(id);
}

module.exports = { create, findByEmail, findById, findByIdWithSecrets, listByCompany, update };
