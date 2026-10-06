// Private operator command; supply secrets in process environment, never arguments.
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('SETUP_DATABASE_REQUIRED');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const result = await require('../src/modules/auth/setup.service').initialize({ name: process.env.SETUP_NAME, companyName: process.env.SETUP_COMPANY_NAME, email: process.env.SETUP_EMAIL, password: process.env.SETUP_PASSWORD }, process.env.INITIAL_SETUP_TOKEN);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(typeof error.code === 'string' ? error.code : 'PRIVATE_SETUP_FAILED'); process.exitCode = 1; }
  finally { delete process.env.SETUP_PASSWORD; delete process.env.INITIAL_SETUP_TOKEN; await mongoose.disconnect(); }
})();
