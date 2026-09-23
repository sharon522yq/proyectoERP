const { asyncHandler } = require('../../utils/ApiError');
const service = require('./audit.service');

const list = asyncHandler(async (req, res) => {
  const result = await service.list({
    companyId: req.companyId,
    module: req.query.module,
    page: parseInt(req.query.page || '1', 10),
    limit: Math.min(parseInt(req.query.limit || '20', 10), 100)
  });
  res.json({ success: true, data: result });
});

module.exports = { list };
