const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../users/user.model');
const Company = require('../companies/company.model');
const { ensureSeeded } = require('../roles/role.service');
const { ApiError } = require('../../utils/ApiError');

const Setup = mongoose.models.InitialSetup || mongoose.model('InitialSetup', new mongoose.Schema({ _id: String }), 'initial_setup');

async function status() {
  return { available: Boolean(process.env.INITIAL_SETUP_TOKEN) && await User.countDocuments() === 0 };
}

async function initialize(data, suppliedToken) {
  const expected = process.env.INITIAL_SETUP_TOKEN || '';
  const a = Buffer.from(suppliedToken || '');
  const b = Buffer.from(expected);
  if (b.length < 32 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ApiError(403, 'Código de configuración inválido', 'SETUP_FORBIDDEN');
  }
  await ensureSeeded();
  // El índice _id impide dos inicializaciones concurrentes.
  await Setup.init();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (await User.countDocuments().session(session)) throw new ApiError(409, 'El sistema ya tiene usuarios', 'SETUP_COMPLETE');
      await Setup.create([{ _id: 'initial-setup' }], { session });
      const [company] = await Company.create([{ name: data.companyName, email: data.email }], { session });
      await User.create([{
        name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12),
        role: 'ADMIN', companyId: company._id
      }], { session });
    });
    return { ok: true };
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'El sistema ya fue configurado', 'SETUP_COMPLETE');
    throw error;
  } finally { await session.endSession(); }
}
module.exports = { status, initialize };
