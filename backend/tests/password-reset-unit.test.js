jest.mock('../src/modules/users/user.repository', () => ({ findByEmail: jest.fn(), update: jest.fn() }));
jest.mock('../src/modules/users/user.model', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../src/utils/passwordResetMail', () => ({ sendPasswordReset: jest.fn() }));
const repo = require('../src/modules/users/user.repository');
const User = require('../src/modules/users/user.model');
const mail = require('../src/utils/passwordResetMail');
const service = require('../src/modules/auth/auth.service');
const bcrypt = require('bcryptjs');
beforeEach(() => jest.clearAllMocks());
test('cuenta desconocida no genera token ni correo', async () => {
  repo.findByEmail.mockResolvedValue(null);
  expect(await service.forgotPassword('missing@example.com')).toEqual({ ok: true });
  expect(mail.sendPasswordReset).not.toHaveBeenCalled();
});
test('recuperación almacena hash y envía el token por correo', async () => {
  repo.findByEmail.mockResolvedValue({ _id: 'user1', email: 'user@example.com', active: true });
  await service.forgotPassword('user@example.com');
  const token = mail.sendPasswordReset.mock.calls[0][1];
  expect(token).toHaveLength(64);
  expect(repo.update.mock.calls[0][1].resetTokenHash).not.toBe(token);
  expect(repo.update.mock.calls[0][1].resetExpires.getTime()).toBeGreaterThan(Date.now());
});
test('restablecimiento consume token atómicamente y revoca refresh', async () => {
  User.findOneAndUpdate.mockResolvedValue({ _id: 'user1' });
  expect(await service.resetPassword('a'.repeat(64), 'Password123')).toEqual({ ok: true });
  const [filter, update] = User.findOneAndUpdate.mock.calls[0];
  expect(filter.active).toBe(true);
  expect(filter.resetExpires.$gt).toBeInstanceOf(Date);
  expect(update.$unset).toEqual({ resetTokenHash: '', resetExpires: '' });
  expect(update.$set.refreshTokenHash).toBeNull();
  expect(await bcrypt.compare('Password123', update.$set.passwordHash)).toBe(true);
});
test('token expirado o usado es rechazado', async () => {
  User.findOneAndUpdate.mockResolvedValue(null);
  await expect(service.resetPassword('a'.repeat(64), 'Password123')).rejects.toMatchObject({ code: 'INVALID_RESET' });
});
