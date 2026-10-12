const mongoose = require('mongoose');
const objectId = mongoose.Schema.Types.ObjectId;
const model = (name, fields, indexes = []) => {
  const schema = new mongoose.Schema(fields, { timestamps: true });
  for (const index of indexes) schema.index(...index);
  return mongoose.models[name] || mongoose.model(name, schema);
};

const Contract = model('CommercialContract', {
  ownerId: { type: objectId, ref: 'User', required: true, index: true },
  pendingOwnerId: { type: objectId, unique: true, sparse: true },
  companyName: { type: String, required: true, maxlength: 120 },
  companyId: { type: objectId, ref: 'Company' },
  plan: { type: mongoose.Schema.Types.Mixed, required: true },
  termsAcceptance: { version: String, acceptedAt: Date },
  status: { type: String, enum: ['pending', 'checkout', 'paid', 'active', 'expired', 'canceled', 'restricted'], default: 'pending' },
  sessionId: { type: String },
  subscriptionId: { type: String }, customerId: String,
  periodEnd: Date, cancelAtPeriodEnd: { type: Boolean, default: false },
  configuredAt: Date,
  holdReason: { type: String, enum: ['refund', 'dispute'] },
  // Serializes concurrent membership changes inside MongoDB transactions.
  seats: { type: Number, default: 1 },
  lastReconciledAt: Date,
  reconcileLeaseId: String, reconcileLeaseUntil: Date
}, [[{ sessionId: 1 }, { unique: true, sparse: true }], [{ subscriptionId: 1 }, { unique: true, sparse: true }]]);

const Token = model('CommercialToken', {
  hash: { type: String, required: true, unique: true },
  kind: { type: String, enum: ['verify', 'invite'], required: true },
  userId: objectId, companyId: objectId, invitedBy: objectId, email: String, role: String, commercial: Boolean,
  expiresAt: { type: Date, required: true }, usedAt: Date
}, [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]]);

const Event = model('CommercialEvent', {
  providerId: { type: String, required: true, unique: true },
  type: String, status: { type: String, enum: ['received', 'processed'], default: 'received' },
  processedAt: Date
});

const Mail = model('CommercialMail', {
  to: { type: String, required: true }, subject: String,
  notificationId: { type: String, unique: true, sparse: true },
  // Token links are secrets. Never return or log the outbox through an API.
  text: { type: String, select: false },
  status: { type: String, enum: ['pending', 'sent'], default: 'pending' },
  attempts: { type: Number, default: 0 }, nextAttemptAt: Date, sentAt: Date
});

const Payment = model('CommercialPayment', {
  invoiceId: { type: String, unique: true, required: true },
  contractId: { type: objectId, required: true, index: true },
  amount: Number, currency: String, status: { type: String, enum: ['paid', 'refunded', 'disputed'], required: true },
  receiptUrl: String
});

const Membership = model('CommercialMembership', {
  userId: { type: objectId, ref: 'User', required: true },
  companyId: { type: objectId, ref: 'Company', required: true },
  role: { type: String, enum: ['ADMIN', 'VENTAS', 'GERENTE', 'FINANZAS', 'COMPRAS', 'ALMACEN', 'RRHH', 'PRODUCCION', 'EMPLEADO'], required: true },
  commercial: { type: Boolean, default: true }
}, [[{ userId: 1, companyId: 1 }, { unique: true }]]);

module.exports = { Contract, Token, Event, Mail, Payment, Membership };
