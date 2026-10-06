const { sendPasswordReset } = require('../../utils/passwordResetMail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const userRepo = require('../users/user.repository');
const User = require('../users/user.model');
const roleService = require('../roles/role.service');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// Registro privilegiado (elegir role/companyId libremente): solo en tests, o con
// ALLOW_PRIVILEGED_REGISTER=true explícito. En producción/staging el registro
// público queda limitado al rol EMPLEADO sin companyId (previene escalada de privilegios).
function privilegedRegisterAllowed() {
  if (process.env.ALLOW_PRIVILEGED_REGISTER !== undefined) {
    return ['test', 'development'].includes(env.env) && process.env.ALLOW_PRIVILEGED_REGISTER === 'true';
  }
  return env.env === 'test';
}

async function permissionsFor(roleName) {
  const role = await roleService.findByName(roleName);
  return role ? role.permissions : [];
}

function signAccess(user, permissions) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, companyId: user.companyId ? String(user.companyId) : null, permissions, version: user.sessionVersion || 0 },
    env.jwt.secret, { expiresIn: env.jwt.accessExpires }
  );
}

function signRefresh(user) {
  // jti único garante que cada refresh token sea distinto aunque iat sea el mismo segundo
  return jwt.sign(
    { sub: String(user._id), type: 'refresh', jti: crypto.randomUUID(), version: user.sessionVersion || 0 },
    env.jwt.refreshSecret,
    { expiresIn: `${env.jwt.refreshExpiresDays}d` }
  );
}

async function register(data, ip) {
  const privileged = privilegedRegisterAllowed();
  const roleName = privileged ? String(data.role || 'EMPLEADO').toUpperCase() : 'EMPLEADO';
  const role = await roleService.findByName(roleName);
  if (!role) throw new ApiError(400, 'Rol inválido', 'INVALID_ROLE');
  if (await userRepo.findByEmail(data.email.toLowerCase())) {
    throw new ApiError(409, 'Email ya registrado', 'EMAIL_TAKEN');
  }
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await userRepo.create({
    name: data.name, email: data.email.toLowerCase(), passwordHash,
    role: role.name, companyId: privileged ? (data.companyId || undefined) : undefined
  });
  const refreshToken = signRefresh(user);
  await userRepo.update(user._id, { refreshTokenHash: sha256(refreshToken) });
  await logAudit({ userId: user._id, companyId: user.companyId, action: 'CREATE', module: 'auth', documentId: String(user._id), newData: { email: user.email }, ip });
  const permissions = await permissionsFor(user.role);
  const accessToken = signAccess(user, permissions);
  return { user: user.toSafeJSON(), permissions, accessToken, refreshToken };
}

async function login(email, password, ip) {
  const user = await userRepo.findByEmail(String(email).toLowerCase());
  if (!user || !user.active) throw new ApiError(401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  const permissions = await permissionsFor(user.role);
  const accessToken = signAccess(user, permissions);
  const refreshToken = signRefresh(user);
  await userRepo.update(user._id, { refreshTokenHash: sha256(refreshToken) });
  await logAudit({ userId: user._id, companyId: user.companyId, action: 'LOGIN', module: 'auth', ip });
  const safe = (await userRepo.findById(user._id)).toSafeJSON();
  return { user: safe, permissions, accessToken, refreshToken };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch {
    throw new ApiError(401, 'Refresh inválido', 'INVALID_REFRESH');
  }
  const user = await userRepo.findByIdWithSecrets(payload.sub);
  if (!user || !user.active) throw new ApiError(401, 'Refresh inválido', 'INVALID_REFRESH');
  const hash = sha256(refreshToken);
  if (payload.type !== 'refresh' || (payload.version || 0) !== (user.sessionVersion || 0) || user.refreshTokenHash !== hash) throw new ApiError(401, 'Refresh inválido', 'INVALID_REFRESH');

  // Rotación: emitir nuevo refresh e invalidar el viejo
  const permissions = await permissionsFor(user.role);
  const newRefresh = signRefresh(user);
  const rotated = await User.updateOne({ _id: user._id, active: true, refreshTokenHash: hash, sessionVersion: user.sessionVersion || 0 }, { $set: { refreshTokenHash: sha256(newRefresh) } });
  if (!rotated.modifiedCount) throw new ApiError(401, 'Refresh inválido', 'INVALID_REFRESH');
  return { accessToken: signAccess(user, permissions), refreshToken: newRefresh, permissions };
}

async function logout(userId, refreshToken, ip) {
  const user = await userRepo.findById(userId);
  await User.updateOne({ _id: userId }, { $set: { refreshTokenHash: null }, $inc: { sessionVersion: 1 } });
  await logAudit({ userId, companyId: user ? user.companyId : undefined, action: 'LOGOUT', module: 'auth', ip });
  return { ok: true };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findByIdWithSecrets(userId);
  if (!user) throw new ApiError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Contraseña actual incorrecta', 'INVALID_CREDENTIALS');
  const changed = await User.updateOne({ _id: userId, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion || 0 }, { $set: { passwordHash: await bcrypt.hash(newPassword, 12), refreshTokenHash: null }, $unset: { resetTokenHash: '', resetExpires: '' }, $inc: { sessionVersion: 1 } });
  if (!changed.modifiedCount) throw new ApiError(409, 'La sesión cambió; vuelve a iniciar sesión', 'SESSION_CHANGED');
  return { ok: true };
}

async function forgotPassword(email) {
  const user = await userRepo.findByEmail(String(email).toLowerCase());
  if (!user || !user.active) return { ok: true };
  const token = crypto.randomBytes(32).toString('hex');
  await userRepo.update(user._id, { resetTokenHash: sha256(token), resetExpires: new Date(Date.now() + 3600e3) });
  await sendPasswordReset(user.email, token);
  if (env.env !== 'test') return { ok: true };
  return { ok: true, resetToken: token };
}

async function resetPassword(token, newPassword) {
  const hash = sha256(token);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const user = await User.findOneAndUpdate(
    { resetTokenHash: hash, resetExpires: { $gt: new Date() }, active: true },
    { $set: { passwordHash, refreshTokenHash: null }, $unset: { resetTokenHash: '', resetExpires: '' }, $inc: { sessionVersion: 1 } }
  );
  if (!user) throw new ApiError(400, 'Token inválido o expirado', 'INVALID_RESET');
  return { ok: true };
}

module.exports = { register, login, refresh, logout, changePassword, forgotPassword, resetPassword };
