require('dotenv').config();
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');

(async () => {
  let created = 0;
  let alreadyPresent = 0;
  let missingCompany = 0;
  let unsupportedRole = 0;
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });

    const User = require('../src/modules/users/user.model');
    const Company = require('../src/modules/companies/company.model');
    const { Contract, Membership } = require('../src/modules/commercial/models');
    const allowedRoles = new Set(Membership.schema.path('role').enumValues);
    const users = await User.find({ companyId: { $exists: true, $ne: null } })
      .select('_id companyId role').lean();
    const companyIds = [...new Set(users.map(user => String(user.companyId)))];
    const activeCompanies = await Company.find({ _id: { $in: companyIds }, active: { $ne: false } }).select('_id').lean();
    const activeCompanyIds = new Set(activeCompanies.map(company => String(company._id)));
    const contracts = await Contract.find({ companyId: { $in: companyIds } }).select('companyId').lean();
    const commercialCompanyIds = new Set(contracts.map(contract => String(contract.companyId)));

    for (const user of users) {
      if (!allowedRoles.has(user.role)) { unsupportedRole++; continue; }
      if (!activeCompanyIds.has(String(user.companyId))) { missingCompany++; continue; }

      const filter = { userId: user._id, companyId: user.companyId };
      if (await Membership.exists(filter)) { alreadyPresent++; continue; }
      if (apply) {
        await Membership.updateOne(filter, { $setOnInsert: {
          role: user.role,
          commercial: commercialCompanyIds.has(String(user.companyId))
        } }, { upsert: true });
        created++;
      }
    }

    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', usersWithCompany: users.length,
      membershipsToCreate: apply ? created : users.length - alreadyPresent - missingCompany - unsupportedRole,
      created, alreadyPresent, missingCompany, unsupportedRole }));
  } catch (error) {
    console.error('MEMBERSHIP_BACKFILL_FAILED: comprueba conexión, permisos e integridad de datos.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
