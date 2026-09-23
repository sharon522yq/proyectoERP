const Account = require('./account.model');
const Transaction = require('./transaction.model');

async function createAccount(data) { return Account.create(data); }
async function findAccountById(id) { return Account.findById(id); }
async function findAccountByCode(companyId, code) { return Account.findOne({ companyId, code }); }
async function listAccounts(companyId, { type } = {}) {
  const filter = { companyId };
  if (type) filter.type = type;
  return Account.find(filter).sort({ code: 1 }).lean();
}
async function updateAccount(id, data) {
  await Account.updateOne({ _id: id }, { $set: data });
  return Account.findById(id);
}

async function createTransaction(data) { return Transaction.create(data); }
async function listTransactions(companyId, { page = 1, limit = 20, accountId, type, startDate, endDate } = {}) {
  const filter = { companyId };
  if (accountId) filter.accountId = accountId;
  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

module.exports = { createAccount, findAccountById, findAccountByCode, listAccounts, updateAccount, createTransaction, listTransactions };
