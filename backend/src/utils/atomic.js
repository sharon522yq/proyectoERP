const mongoose = require('mongoose');
mongoose.set('transactionAsyncLocalStorage', true);
// Nested service calls must participate in the caller's transaction.
module.exports = fn => async (...args) => {
  const session = mongoose.transactionAsyncLocalStorage?.getStore()?.session;
  if (session?.inTransaction()) return fn(...args);
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await mongoose.connection.transaction(() => fn(...args)); }
    catch (error) { if (error.code !== 11000 || attempt === 2) throw error; }
  }
};
