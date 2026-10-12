require('dotenv').config();
const mongoose = require('mongoose');
const { sweep } = require('../src/modules/commercial/service');
const { deliver } = require('../src/modules/commercial/mail');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const reconciliation = await sweep();
    const mail = await deliver();
    console.log(JSON.stringify({ reconciliation, mail }));
    if (reconciliation.failed) process.exitCode = 1;
  } catch {
    console.error('COMMERCIAL_WORKER_FAILED');
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
})();
