const crypto = require('crypto');
const mongoose = require('mongoose');
function databaseIdentity() {
  if (mongoose.connection.readyState !== 1) return null;
  const options = mongoose.connection.getClient().options;
  const destination = options.srvHost || (options.hosts || []).map(host => host.toString()).sort().join(',');
  return crypto.createHash('sha256').update(`${destination}|${mongoose.connection.name}`).digest('hex');
}
module.exports = { databaseIdentity };
