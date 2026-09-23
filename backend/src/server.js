const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { version } = require('../package.json');
const { ensureSeeded } = require('./modules/roles/role.service');
const { ensureSeeded: seedUnits } = require('./modules/products/unit.service');

async function main() {
  if (!env.mongoUri) {
    console.error('MONGODB_URI no configurado. Copia .env.example a .env');
    process.exit(1);
  }
  await connectDB(env.mongoUri);
  await ensureSeeded();
  await seedUnits();
  const app = createApp();
  app.listen(env.port, () => console.log(`ERP backend v${version} en puerto ${env.port}`));
}

if (require.main === module) main();

module.exports = { main };
