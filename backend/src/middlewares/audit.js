const Audit = require('../modules/audit/audit.model');

// Fire-and-forget: nunca debe romper la operación principal.
async function logAudit({ userId, companyId, action, module, documentId, previousData, newData, ip }) {
  try {
    await Audit.create({ userId, companyId, action, module, documentId, previousData, newData, ip });
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}

module.exports = { logAudit };
