const Audit = require('../modules/audit/audit.model');

// Operational transactions include their audit entry and must retry together.
async function logAudit({ userId, companyId, action, module, documentId, previousData, newData, ip }) {
  try {
    await Audit.create({ userId, companyId, action, module, documentId, previousData, newData, ip });
  } catch (e) {
    const session = require('mongoose').transactionAsyncLocalStorage?.getStore()?.session;
    if (session?.inTransaction()) throw e;
    console.error('audit log failed', e.code || 'AUDIT_WRITE_FAILED');
  }
}

module.exports = { logAudit };
