// Ephemeral, isolated QA preview. No production database or payment credentials.
if (process.env.NODE_ENV === 'production') throw new Error('Preview forbidden in production');
process.env.NODE_ENV = 'test';
process.env.ALLOW_PRIVILEGED_REGISTER = 'false';
process.env.COMMERCIAL_MODE = 'disabled';
process.env.COMMERCIAL_AMOUNT_MINOR = '10000'; // Fictional fixture only.
process.env.FRONTEND_URL = 'http://localhost:8086';
const mongoose = require('mongoose');
const express = require('express');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const path = require('path');

(async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await ensureSeeded();
  const outer = express();
  outer.use(express.static(path.resolve(__dirname, '../../frontend/dist-commercial')));
  outer.use(createApp());
  const server = outer.listen(8086, '127.0.0.1', () => console.log('QA preview: http://localhost:8086 (checkout disabled)'));
  const stop = async () => { server.close(); await mongoose.disconnect(); await mongo.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})();
