const { Router } = require('express');
const { asyncHandler } = require('../../utils/ApiError');
const { authenticate, requirePermission, scopeCompany } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/http');
const Setting = require('./settings.model');
const { logAudit } = require('../../middlewares/audit');
const v = require('./settings.validation');

const router = Router();
router.use(authenticate, scopeCompany);

router.get('/', requirePermission('settings.read'), asyncHandler(async (req, res) => {
  const items = await Setting.find({ companyId: req.companyId }).lean();
  res.json({ success: true, data: items });
}));

router.put('/', requirePermission('settings.update'), v.putRules, validate, asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  const previous = await Setting.findOne({ companyId: req.companyId, key }).lean();
  const item = await Setting.findOneAndUpdate(
    { companyId: req.companyId, key }, { value }, { upsert: true, new: true }
  );
  await logAudit({
    userId: req.user.id, companyId: req.companyId, action: previous ? 'UPDATE' : 'CREATE',
    module: 'settings', documentId: String(item._id),
    previousData: previous ? { value: previous.value } : undefined, newData: { key, value }, ip: req.ip
  });
  res.json({ success: true, data: item });
}));

module.exports = router;
