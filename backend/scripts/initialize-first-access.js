require('dotenv').config();
const mongoose = require('mongoose');
const { initialize } = require('../src/modules/initialization/firstAccess.service');

(async () => {
  try {
    if (!process.env.MONGODB_URI) throw Object.assign(new Error(), { code: 'MONGODB_URI_REQUIRED' });
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    if (process.argv.includes('--inspect')) {
      const User = require('../src/modules/users/user.model');
      const Company = require('../src/modules/companies/company.model');
      console.log(JSON.stringify({ target: process.env.BOOTSTRAP_TARGET || 'unidentified', database: mongoose.connection.name,
        users: await User.countDocuments(), companies: await Company.countDocuments() }));
      return;
    }
    const apiUrl = process.env.BOOTSTRAP_API_URL || (process.env.BOOTSTRAP_TARGET === 'development' ? 'http://127.0.0.1:8086/api/v1' : '');
    if (!apiUrl) throw Object.assign(new Error(), { code: 'BACKEND_API_URL_REQUIRED' });
    const healthUrl = new URL('/health', apiUrl).toString();
    const health = await (await fetch(healthUrl, { signal: AbortSignal.timeout(10000) })).json();
    if (health.privateInitialization !== 'first-access-v1' || health.environment !== process.env.BOOTSTRAP_TARGET ||
      health.databaseIdentity !== require('../src/modules/initialization/databaseIdentity').databaseIdentity() ||
      (process.env.BOOTSTRAP_TARGET === 'production' && !health.internalAccessEnabled)) {
      throw Object.assign(new Error(), { code: 'BACKEND_DESTINATION_MISMATCH' });
    }
    const result = await initialize({ target: process.env.BOOTSTRAP_TARGET, name: process.env.BOOTSTRAP_NAME,
      email: process.env.BOOTSTRAP_EMAIL, password: process.env.BOOTSTRAP_PASSWORD, companyName: process.env.BOOTSTRAP_COMPANY_NAME,
      reason: process.env.BOOTSTRAP_ACCESS_REASON, expiresAt: process.env.BOOTSTRAP_ACCESS_EXPIRES });
    if (result.target === 'development') {
      process.env.DEVELOPMENT_FIXTURES_ENABLED = 'true';
      await require('../src/modules/initialization/developmentFixtures').seedDevelopmentFixtures(result.companyId);
    }
    // Password is held only in process memory. Exercise real login and dashboard
    // against the identified backend; never print response tokens or user data.
    const login = await fetch(`${apiUrl}/auth/login`, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.BOOTSTRAP_EMAIL.trim().toLowerCase(), password: process.env.BOOTSTRAP_PASSWORD }) });
    const sessionData = await login.json();
    if (!login.ok || !sessionData.data?.accessToken) throw Object.assign(new Error(), { code: 'ACCOUNT_CREATED_LOGIN_PENDING' });
    const headers = { Authorization: `Bearer ${sessionData.data.accessToken}` };
    const companies = await fetch(`${apiUrl}/commercial/memberships`, { headers, signal: AbortSignal.timeout(10000) });
    const dashboard = await fetch(`${apiUrl}/dashboard`, { headers, signal: AbortSignal.timeout(10000) });
    if (!companies.ok || !dashboard.ok) throw Object.assign(new Error(), { code: 'ACCOUNT_CREATED_DASHBOARD_PENDING' });
    await fetch(`${apiUrl}/auth/logout`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionData.data.refreshToken }), signal: AbortSignal.timeout(10000) });
    console.log(JSON.stringify({ ...result, database: mongoose.connection.name, login: 'passed', memberships: 'passed', dashboard: 'passed', smokeSession: 'closed' }));
  } catch (error) {
    // Never print raw driver errors, input, passwords, connection strings or hashes.
    console.error(JSON.stringify({ code: typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'FIRST_ACCESS_FAILED' }));
    process.exitCode = 1;
  } finally {
    delete process.env.BOOTSTRAP_PASSWORD;
    await mongoose.disconnect();
  }
})();
