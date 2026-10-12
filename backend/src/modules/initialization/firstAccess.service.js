const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../users/user.model');
const Company = require('../companies/company.model');
const Branch = require('../branches/branch.model');
const Role = require('../roles/role.model');
const Audit = require('../audit/audit.model');
const { Membership } = require('../commercial/models');
const FirstAccess = require('./firstAccess.model');
const AccessGrant = require('./accessGrant.model');
const { ROLE_SEEDS } = require('../../config/permissions');

const modules = ['crm', 'products', 'inventory', 'sales', 'purchases', 'finance', 'hr', 'projects', 'production', 'dashboard', 'ai'];
function fail(code) { const error = new Error(code); error.code = code; throw error; }

function validate(input) {
  if (!['development', 'production'].includes(input.target)) fail('TARGET_REQUIRED');
  if (input.target === 'production' && process.env.NODE_ENV !== 'production') fail('TARGET_ENVIRONMENT_MISMATCH');
  if (input.target === 'development' && !['development', 'test'].includes(process.env.NODE_ENV || 'development')) fail('TARGET_ENVIRONMENT_MISMATCH');
  if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.email.length > 254) fail('INVALID_EMAIL');
  if (typeof input.password !== 'string' || input.password.length < 8 || Buffer.byteLength(input.password, 'utf8') > 72) fail('INVALID_PASSWORD');
  if (typeof input.companyName !== 'string' || input.companyName.trim().length < 2 || input.companyName.trim().length > 120) fail('INVALID_COMPANY');
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 120) fail('INVALID_NAME');
  if (typeof input.reason !== 'string' || input.reason.trim().length < 10 || input.reason.length > 500) fail('ACCESS_REASON_REQUIRED');
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 90 * 86400000) fail('INVALID_ACCESS_EXPIRY');
  if (input.target === 'production' && process.env.INTERNAL_ACCESS_ENABLED !== 'true') fail('INTERNAL_ACCESS_NOT_ENABLED');
  return { ...input, email: input.email.trim().toLowerCase(), companyName: input.companyName.trim(), name: input.name.trim(), expiresAt,
    grantMode: input.target === 'production' ? 'internal' : 'development_fixture' };
}

async function initialize(input) {
  const data = validate(input);
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') fail('REPLICA_SET_REQUIRED');
  await Promise.all([User, Role, Membership, FirstAccess, AccessGrant].map(model => model.createIndexes()));
  const passwordHash = await bcrypt.hash(data.password, 12);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const previous = await FirstAccess.findById('first-owner').session(session);
      if (previous) {
        const user = await User.findById(previous.userId).select('+passwordHash').session(session);
        const company = await Company.findById(previous.companyId).session(session);
        const membership = await Membership.findOne({ userId: previous.userId, companyId: previous.companyId }).session(session);
        const grant = await AccessGrant.findOne({ companyId: previous.companyId }).session(session);
        if (previous.target !== data.target || previous.companyName !== data.companyName || previous.grantMode !== data.grantMode ||
          user?.email !== data.email || !user?.active || user.role !== 'ADMIN' || company?.name !== data.companyName || !company.active ||
          membership?.role !== 'ADMIN' || !membership.commercial || grant?.mode !== data.grantMode || !grant.active ||
          grant.expiresAt <= new Date() || !await bcrypt.compare(data.password, user.passwordHash)) fail('FIRST_ACCESS_CONFLICT');
        return { created: false, target: previous.target, userId: String(user._id), companyId: String(company._id), grantMode: grant.mode };
      }
      // This unique marker serializes concurrent initialization attempts. It and
      // every account/company write roll back together if any conflict occurs.
      const userId = new mongoose.Types.ObjectId();
      const companyId = new mongoose.Types.ObjectId();
      await FirstAccess.create([{ _id: 'first-owner', userId, companyId, target: data.target,
        companyName: data.companyName, grantMode: data.grantMode }], { session });
      if (await User.exists({}).session(session) || await Company.exists({}).session(session) ||
          await Membership.exists({}).session(session) || await AccessGrant.exists({}).session(session)) fail('DESTINATION_NOT_EMPTY');
      for (const seed of ROLE_SEEDS.filter(role => role.name !== 'SUPER_ADMIN')) {
        const existing = await Role.findOne({ name: seed.name }).session(session);
        if (existing && JSON.stringify([...existing.permissions].sort()) !== JSON.stringify([...seed.permissions].sort())) fail('ROLE_CONFLICT');
        await Role.updateOne({ name: seed.name }, { $setOnInsert: { ...seed, isSystem: true } }, { upsert: true, session });
      }
      await Company.create([{ _id: companyId, name: data.companyName }], { session });
      await Branch.create([{ companyId, name: 'Principal' }], { session });
      await User.create([{ _id: userId, name: data.name, email: data.email, passwordHash, role: 'ADMIN', companyId,
        commercialAccount: true, emailVerifiedAt: new Date(), firstAccess: { mode: data.grantMode, expiresAt: data.expiresAt } }], { session });
      await Membership.create([{ userId, companyId, role: 'ADMIN', commercial: true }], { session });
      await AccessGrant.create([{ companyId, mode: data.grantMode, modules, expiresAt: data.expiresAt,
        reason: data.reason.trim(), issuedBy: 'private-first-access' }], { session });
      await Audit.create([{ userId, companyId, action: 'CREATE', module: 'first-access', documentId: String(companyId),
        newData: { target: data.target, role: 'ADMIN', grantMode: data.grantMode, expiresAt: data.expiresAt,
          reason: data.reason.trim(), identitySource: 'private-operator-initialization', paymentCreated: false } }], { session });
      return { created: true, target: data.target, userId: String(userId), companyId: String(companyId), grantMode: data.grantMode };
    });
  } catch (error) {
    if (error.code === 11000) fail('FIRST_ACCESS_CONFLICT');
    throw error;
  } finally { await session.endSession(); }
}

module.exports = { initialize, validate };
