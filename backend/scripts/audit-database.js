// Read-only operator audit. Secrets must be supplied through the process environment.
const mongoose = require('mongoose');
(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('DATABASE_REQUIRED');
    const parsed = new URL(uri);
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || parsed.pathname.length < 2) throw new Error('EXPLICIT_DATABASE_REQUIRED');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await mongoose.connection.db.command({ ping: 1 });
    const hello = await mongoose.connection.db.command({ hello: 1 });
    const User = require('../src/modules/users/user.model');
    const Company = require('../src/modules/companies/company.model');
    const Role = require('../src/modules/roles/role.model');
    const [users, companies, roles, usersWithoutCompany, companyAdmins, globalAdmins] = await Promise.all([
      User.countDocuments({}), Company.countDocuments({}), Role.countDocuments({}),
      User.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }),
      User.countDocuments({ role: 'ADMIN', active: true, companyId: { $ne: null } }),
      User.countDocuments({ role: 'SUPER_ADMIN' })
    ]);
    console.log(JSON.stringify({ ok: true, database: mongoose.connection.name, ping: true,
      transactionsSupported: Boolean(hello.setName || hello.msg === 'isdbgrid'),
      counts: { users, companies, roles, usersWithoutCompany, companyAdmins, globalAdmins },
      emptyForInitialSetup: users === 0 && companies === 0 }, null, 2));
  } catch (error) {
    const safe = ['DATABASE_REQUIRED', 'EXPLICIT_DATABASE_REQUIRED'];
    console.error(safe.includes(error.message) ? error.message : 'DATABASE_AUDIT_FAILED');
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
})();
