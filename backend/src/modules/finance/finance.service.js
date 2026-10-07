const money = require('../../utils/money');
const atomic = require('../../utils/atomic');
const repo = require('./finance.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

async function createAccount(data, ctx) {
  if (data.balance && Number(data.balance) !== 0) throw new ApiError(400, 'Registra el saldo inicial mediante un movimiento para conservar su trazabilidad.', 'OPENING_MOVEMENT_REQUIRED');
  if (await repo.findAccountByCode(ctx.companyId, data.code)) throw new ApiError(409, 'Este código de cuenta ya existe. Utiliza otro código.', 'ACCOUNT_CODE_TAKEN');
  const account = await repo.createAccount({ ...data, balance: 0, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'finance.accounts', documentId: String(account._id), newData: { code: account.code, name: account.name }, ip: ctx.ip });
  return account;
}

async function listAccounts(ctx, query) { return repo.listAccounts(ctx.companyId, query); }

async function getAccount(id, ctx) {
  const account = await repo.findAccountById(id);
  if (!account || String(account.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cuenta no encontrada', 'ACCOUNT_NOT_FOUND');
  return account;
}

async function createTransaction(data, ctx) {
  if (!['INCOME', 'EXPENSE'].includes(data.type)) throw new ApiError(400, 'Las transferencias entre cuentas requieren un movimiento de origen y destino vinculado. Esta operación aún no está habilitada.', 'TRANSFER_NOT_SUPPORTED');
  await require('./account.model').updateOne({ _id: data.accountId, companyId: ctx.companyId }, { $inc: { __v: 1 } });
  if (data.requestId) {
    const previous = await require('./transaction.model').findOne({ companyId: ctx.companyId, requestId: data.requestId });
    if (previous) {
      if (String(previous.accountId) !== String(data.accountId) || previous.type !== data.type || previous.amount !== data.amount)
        throw new ApiError(409, 'Este intento de registro ya se utilizó con otros datos. Actualiza los movimientos.', 'TRANSACTION_REQUEST_CONFLICT');
      return previous;
    }
  }
  const account = await repo.findAccountById(data.accountId);
  if (!account || String(account.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Cuenta no encontrada', 'ACCOUNT_NOT_FOUND');

  const tx = await repo.createTransaction({ ...data, companyId: ctx.companyId, branchId: ctx.branchId, createdBy: ctx.userId });

  // Update balance
  const delta = data.type === 'INCOME' ? data.amount : -data.amount;
  await repo.incrementBalance(account._id, delta);

  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'finance.transactions', documentId: String(tx._id), newData: { amount: data.amount, type: data.type }, ip: ctx.ip });
  return tx;
}

async function listTransactions(ctx, query) { return repo.listTransactions(ctx.companyId, query); }

// Summary
async function getSummary(ctx) {
  const accounts = await repo.listAccounts(ctx.companyId);
  const assets = accounts.filter(a => a.type === 'ASSET').reduce((s, a) => s + a.balance, 0);
  const liabilities = accounts.filter(a => a.type === 'LIABILITY').reduce((s, a) => s + a.balance, 0);
  const income = accounts.filter(a => a.type === 'INCOME').reduce((s, a) => s + a.balance, 0);
  const expenses = accounts.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0);
  return { assets: money(assets), liabilities: money(liabilities), income: money(income), expenses: money(expenses), netIncome: money(income - expenses) };
}

// ---- Asientos automáticos entre módulos (D-010) ----
// Crea (si no existe) la cuenta del catálogo operativo y registra el movimiento,
// actualizando el saldo de la cuenta. Usado por sales/purchases vía llamada interna.
async function getOrCreateSystemAccount({ companyId, code, name, type }) {
  let account = await repo.findAccountByCode(companyId, code);
  if (account) return account;
  try {
    account = await repo.createAccount({ companyId, code, name, type, balance: 0 });
    return account;
  } catch (err) {
    // Carrera única (índice unique companyId+code): reintentar lectura
    if (err && err.code === 11000) return repo.findAccountByCode(companyId, code);
    throw err;
  }
}

async function postSystemTransaction(entry) {
  const { companyId, branchId, userId, accountCode, accountName, accountType,
    type, amount, description, referenceType, referenceId, category } = entry;
  if (!(amount > 0)) return null;
  const account = await getOrCreateSystemAccount({ companyId, code: accountCode, name: accountName, type: accountType });
  const tx = await repo.createTransaction({
    companyId, branchId: branchId || null, accountId: account._id, type, amount,
    description, referenceType, referenceId: referenceId || undefined,
    category, createdBy: userId
  });
  const delta = type === 'INCOME' ? amount : -amount;
  await repo.incrementBalance(account._id, delta);
  await logAudit({ userId, companyId, action: 'CREATE', module: 'finance.auto', documentId: String(tx._id), newData: { accountCode, type, amount, referenceType } });
  return tx;
}

module.exports = { createAccount, listAccounts, getAccount, createTransaction: atomic(createTransaction), listTransactions, getSummary, postSystemTransaction: atomic(postSystemTransaction) };
