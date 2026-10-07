const mongoose = require('mongoose');
mongoose.set('transactionAsyncLocalStorage', true);
// Nested service calls must participate in the caller's transaction.
module.exports = fn => (...args) => {
  const session = mongoose.transactionAsyncLocalStorage?.getStore()?.session;
  if (session?.inTransaction()) return fn(...args);
  return mongoose.connection.transaction(() => fn(...args));
};
