require('dotenv').config();
const mongoose = require('mongoose');
const { Contract, Event, Mail } = require('../src/modules/commercial/models');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const status = await Contract.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    console.log(JSON.stringify({ status,
      eventsPending: await Event.countDocuments({ status: 'received' }),
      mailPending: await Mail.countDocuments({ status: 'pending' }),
      activationsPending: await Contract.countDocuments({ status: 'checkout', companyId: { $exists: false } })
    }));
  } catch { console.error('COMMERCIAL_STATUS_FAILED'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
