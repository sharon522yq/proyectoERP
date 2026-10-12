// Restricted to operators with database credentials. Never expose this as a tenant API.
require('dotenv').config();
const mongoose = require('mongoose');
const { Contract } = require('../src/modules/commercial/models');
const { reconcile } = require('../src/modules/commercial/service');

(async () => {
  try {
    const [contractId, action, ...reasonParts] = process.argv.slice(2);
    const reason = reasonParts.join(' ');
    if (!mongoose.isValidObjectId(contractId) || !['reconcile', 'clear-hold'].includes(action) || reason.length < 10) {
      throw new Error('Usage: node scripts/commercial-support.js CONTRACT_ID reconcile|clear-hold "documented reason"');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    if (action === 'clear-hold') {
      // Operator must verify dispute/refund resolution at the provider first.
      await Contract.updateOne({ _id: contractId }, { $unset: { holdReason: 1 } });
    }
    await require('../src/modules/audit/audit.model').create({ action: 'UPDATE', module: 'commercial-support',
      companyId: contract.companyId, documentId: contractId, newData: { action, reason } });
    await reconcile(contractId);
    console.log('COMMERCIAL_SUPPORT_RECONCILED');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
