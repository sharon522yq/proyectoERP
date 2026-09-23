const { asyncHandler } = require('../../utils/ApiError');
const service = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await service.register(req.body, req.ip);
  res.status(201).json({ success: true, data: result });
});
const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body.email, req.body.password, req.ip);
  res.json({ success: true, data: result });
});
const refresh = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.refresh(req.body.refreshToken) });
});
const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.logout(req.user.id, req.body.refreshToken, req.ip) });
});
const changePassword = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword) });
});
const forgotPassword = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.forgotPassword(req.body.email) });
});
const resetPassword = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.resetPassword(req.body.token, req.body.newPassword) });
});

module.exports = { register, login, refresh, logout, changePassword, forgotPassword, resetPassword };
