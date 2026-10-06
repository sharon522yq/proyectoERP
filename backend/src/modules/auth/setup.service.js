const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../users/user.model');
const Company = require('../companies/company.model');
const Role = require('../roles/role.model');
const Audit = require('../audit/audit.model');
const { ROLE_SEEDS } = require('../../config/permissions');
const { ApiError } = require('../../utils/ApiError');
const Setup = mongoose.models.InitialSetup || mongoose.model('InitialSetup', new mongoose.Schema({ _id: String, userId: mongoose.Schema.Types.ObjectId, companyId: mongoose.Schema.Types.ObjectId }), 'initial_setup');
async function initialize(data, suppliedToken) {
  const a = Buffer.from(suppliedToken || '');
  const b = Buffer.from(process.env.INITIAL_SETUP_TOKEN || '');
  if (b.length < 32 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ApiError(403, 'Inicialización privada no autorizada', 'SETUP_FORBIDDEN');
  if (typeof data.password !== 'string' || data.password.length < 8 || Buffer.byteLength(data.password) > 72 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') || [data.name, data.companyName].some(x => typeof x !== 'string' || x.trim().length < 2 || x.length > 120)) throw new ApiError(400, 'Datos de inicialización inválidos', 'INVALID_SETUP');
  const email = data.email.trim().toLowerCase();
  const companyName = data.companyName.trim();
  await Promise.all([Setup.init(), User.init(), Role.init(), Company.init(), Audit.init()]);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const existing = await Setup.findById('initial-setup').session(session);
      if (existing) {
        const user = await User.findById(existing.userId).select('+passwordHash').session(session);
        const company = await Company.findById(existing.companyId).session(session);
        if (!user || !company || !user.active || !company.active || user.email !== email || company.name !== companyName || user.role !== 'ADMIN' || String(user.companyId) !== String(company._id) || !await bcrypt.compare(data.password, user.passwordHash)) throw new ApiError(409, 'Conflicto de inicialización', 'SETUP_CONFLICT');
        return { ok: true, created: false };
      }
      const userId = new mongoose.Types.ObjectId(), companyId = new mongoose.Types.ObjectId();
      await Setup.create([{ _id: 'initial-setup', userId, companyId }], { session });
      if (await User.exists({}).session(session) || await Company.exists({}).session(session)) throw new ApiError(409, 'Destino no vacío', 'SETUP_COMPLETE');
      for (const seed of ROLE_SEEDS.filter(r => r.name !== 'SUPER_ADMIN')) {
        const role = await Role.findOne({ name: seed.name }).session(session);
        if (role && JSON.stringify([...role.permissions].sort()) !== JSON.stringify([...seed.permissions].sort())) throw new ApiError(409, 'Conflicto de permisos', 'SETUP_CONFLICT');
        await Role.updateOne({ name: seed.name }, { $setOnInsert: { ...seed, isSystem: true } }, { upsert: true, session });
      }
      await Company.create([{ _id: companyId, name: companyName, email }], { session });
      await User.create([{ _id: userId, name: data.name.trim(), email, passwordHash, role: 'ADMIN', companyId }], { session });
      await Audit.create([{ userId, companyId, action: 'CREATE', module: 'initial-setup', documentId: String(companyId), newData: { role: 'ADMIN', mechanism: 'private-cli' } }], { session });
      return { ok: true, created: true };
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'Conflicto de inicialización', 'SETUP_CONFLICT');
    throw error;
  } finally { await session.endSession(); }
}
module.exports = { initialize };
