const { asyncHandler } = require('../../utils/ApiError');
const service = require('./role.service');

const list = asyncHandler(async (req, res) => {
  const roles = await service.list();
  res.json({ success: true, data: roles });
});

module.exports = { list };
