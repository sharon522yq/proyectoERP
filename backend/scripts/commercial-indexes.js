require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('MongoDB replica set required');
    const models = [require('../src/modules/users/user.model'), ...Object.values(require('../src/modules/commercial/models'))];
    // createIndexes adds missing indexes; it never drops existing indexes.
    for (const model of models) await model.createIndexes();
    console.log('COMMERCIAL_INDEXES_CREATED');
  } catch (error) {
    console.error('COMMERCIAL_INDEXES_FAILED: comprueba conexión, permisos y duplicados.');
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
})();
