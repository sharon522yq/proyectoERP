const crypto = require('crypto');
const mongoose = require('mongoose');
const { Contract, Token, Event, Payment, Membership } = require('./models');
const User = require('../users/user.model');
const Company = require('../companies/company.model');
const Branch = require('../branches/branch.model');
const { ApiError } = require('../../utils/ApiError');
const { catalog, checkoutConfig } = require('./catalog');
const { enqueue } = require('./mail');
const provider = require('./provider');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const INVITABLE_ROLES = ['VENTAS', 'GERENTE', 'FINANZAS', 'COMPRAS', 'ALMACEN', 'RRHH', 'PRODUCCION', 'EMPLEADO'];

async function transaction(fn) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => fn(session)); }
  finally { await session.endSession(); }
}

async function isCommercialInvitation(token, session) {
  if (typeof token.commercial === 'boolean') return token.commercial;
  // Invitations issued by the previous release have no commercial flag. Those
  // were only issued to paid contracts, so preserve their seat checks even if
  // the contract has since expired or been restricted.
  return Boolean(await Contract.exists({ companyId: token.companyId }).session(session));
}

async function ensureContract(user, name) {
  return Contract.findOneAndUpdate({ ownerId: user._id }, { $setOnInsert: {
    companyName: name, plan: catalog(), status: 'pending'
  } }, { upsert: true, new: true });
}

async function registerAccount(data, passwordHash) {
  try {
    return await transaction(async session => {
      const [user] = await User.create([{ name: data.name, email: data.email.trim().toLowerCase(), passwordHash,
        role: 'EMPLEADO', commercialAccount: true, verificationSentAt: new Date(),
        termsAcceptance: { version: data.termsVersion, acceptedAt: new Date() }
      }], { session });
      await Contract.create([{ ownerId: user._id, pendingOwnerId: user._id, companyName: data.companyName.trim(), plan: catalog(),
        termsAcceptance: { version: data.termsVersion, acceptedAt: new Date() } }], { session });
      const raw = crypto.randomBytes(32).toString('hex');
      await Token.create([{ hash: hash(raw), kind: 'verify', userId: user._id, expiresAt: new Date(Date.now() + 86400000) }], { session });
      await enqueue(user.email, 'Verifica tu cuenta ERP', `${process.env.FRONTEND_URL || 'http://localhost:19006'}/#verify?token=${raw}`, session);
      return user;
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'Email ya registrado', 'EMAIL_TAKEN');
    throw error;
  }
}

async function sendVerification(userId) {
  const now = new Date();
  const user = await User.findOneAndUpdate({ _id: userId,
    emailVerifiedAt: { $exists: false },
    $or: [{ verificationSentAt: { $exists: false } }, { verificationSentAt: { $lt: new Date(Date.now() - 60000) } }]
  }, { $set: { verificationSentAt: now } }, { new: true });
  if (!user) throw new ApiError(429, 'Espera un minuto o revisa si ya verificaste tu correo', 'VERIFY_LIMIT');
  const raw = crypto.randomBytes(32).toString('hex');
  await Token.create({ hash: hash(raw), kind: 'verify', userId, expiresAt: new Date(Date.now() + 86400000) });
  await enqueue(user.email, 'Verifica tu cuenta ERP', `${process.env.FRONTEND_URL || 'http://localhost:19006'}/#verify?token=${raw}`);
  return { sent: true };
}

async function verify(raw) {
  return transaction(async session => {
    const token = await Token.findOneAndUpdate({ hash: hash(raw), kind: 'verify', usedAt: { $exists: false },
      expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { session });
    if (!token) throw new ApiError(400, 'Token inválido, usado o vencido', 'INVALID_TOKEN');
    await User.updateOne({ _id: token.userId }, { $set: { emailVerifiedAt: new Date() } }, { session });
    return { verified: true };
  });
}

async function getContract(userId) {
  const user = await User.findById(userId);
  const contract = await Contract.findOne({ pendingOwnerId: userId }) ||
    await Contract.findOne({ ownerId: userId, companyId: user?.companyId }) ||
    await Contract.findOne({ ownerId: userId }).sort({ createdAt: -1 });
  if (!contract) throw new ApiError(404, 'Contratación no encontrada', 'CONTRACT_NOT_FOUND');
  return contract;
}

async function subscriptionView(userId) {
  const user = await User.findById(userId);
  const pending = await Contract.findOne({ pendingOwnerId: userId });
  const contract = pending || (user?.companyId ? await Contract.findOne({ companyId: user.companyId }) : await getContract(userId));
  if (!contract) throw new ApiError(404, 'Suscripción no encontrada', 'CONTRACT_NOT_FOUND');
  const isOwner = String(contract.ownerId) === String(userId);
  const payments = isOwner ? await Payment.find({ contractId: contract._id }).select('amount currency status receiptUrl createdAt -_id').lean() : [];
  return { companyName: contract.companyName, companyId: contract.companyId, plan: contract.plan, payments,
    status: contract.status, periodEnd: contract.periodEnd, cancelAtPeriodEnd: contract.cancelAtPeriodEnd,
    configuredAt: contract.configuredAt, seats: contract.seats, isOwner };
}

async function newContract(userId, data) {
  checkoutConfig();
  if (typeof data.companyName !== 'string' || data.companyName.trim().length < 2 || data.companyName.length > 120 ||
    data.acceptTerms !== true || data.termsVersion !== catalog().termsVersion) throw new ApiError(400, 'Empresa y aceptación de términos requeridos', 'INVALID_INPUT');
  const user = await User.findById(userId);
  if (user.role === 'SUPER_ADMIN') throw new ApiError(403, 'Usa una cuenta comercial separada de plataforma', 'PLATFORM_ACCOUNT');
  try {
    const contract = await Contract.findOneAndUpdate({ pendingOwnerId: userId }, { $setOnInsert: {
      ownerId: userId, companyName: data.companyName.trim(), plan: catalog(),
      termsAcceptance: { version: data.termsVersion, acceptedAt: new Date() }
    } }, { upsert: true, new: true });
    await User.updateOne({ _id: userId }, { $set: { termsAcceptance: { version: data.termsVersion, acceptedAt: new Date() } } });
    return contract;
  } catch (error) {
    if (error.code === 11000) return Contract.findOne({ pendingOwnerId: userId });
    throw error;
  }
}

async function memberships(userId) {
  const rows = (await Membership.find({ userId }).populate({ path: 'companyId', select: 'name', match: { active: true } }).select('companyId role commercial').lean()).filter(row => row.companyId);
  const user = await User.findById(userId);
  if (user?.active && user.companyId && user.role !== 'SUPER_ADMIN' && !rows.some(row => String(row.companyId._id) === String(user.companyId))) {
    const company = await Company.findOne({ _id: user.companyId, active: true }).select('name').lean();
    if (company) rows.push({ _id: 'legacy-' + company._id, companyId: company, role: user.role, commercial: !!user.commercialAccount });
  }
  return rows;
}

async function switchCompany(userId, companyId) {
  return transaction(async session => {
    let membership = await Membership.findOne({ userId, companyId }).session(session);
    const user = await User.findOne({ _id: userId, active: true }).session(session);
    if (!user || user.role === 'SUPER_ADMIN') throw new ApiError(403, 'Cuenta no apta para selección de empresa', 'CROSS_COMPANY');
    if (!membership && String(user.companyId) === String(companyId)) membership = { role: user.role, commercial: !!user.commercialAccount };
    if (!membership) throw new ApiError(403, 'No perteneces a esa empresa', 'CROSS_COMPANY');
    if (!await Company.exists({ _id: companyId, active: true }).session(session)) throw new ApiError(403, 'Empresa inactiva', 'COMPANY_INACTIVE');
    await User.updateOne({ _id: userId, active: true }, { $set: { companyId, role: membership.role, commercialAccount: membership.commercial } }, { session });
    await require('../audit/audit.model').create([{ userId, companyId, action: 'UPDATE', module: 'users.memberships', newData: { source: 'company-selection', role: membership.role } }], { session });
    return { switched: true };
  });
}

async function checkout(userId) {
  const config = checkoutConfig();
  const user = await User.findById(userId);
  if (!user?.emailVerifiedAt) throw new ApiError(403, 'Verifica tu correo', 'EMAIL_UNVERIFIED');
  const contract = await getContract(userId);
  if (contract.companyId || ['paid', 'active', 'canceled', 'restricted'].includes(contract.status)) {
    throw new ApiError(409, 'Esta contratación ya tiene suscripción', 'CONTRACT_STATE');
  }
  // Fetch price before creating a session; the browser never supplies an amount.
  const price = await provider.stripe(`prices/${encodeURIComponent(process.env.STRIPE_PRICE_ID)}`, null, 'GET');
  if (!price.active || price.unit_amount !== config.plan.amount || price.currency !== config.plan.currency ||
      price.recurring?.interval !== config.plan.interval || price.recurring.interval_count !== 1) {
    throw new ApiError(503, 'El precio del proveedor no coincide con el catálogo', 'PRICE_MISMATCH');
  }
  if (contract.sessionId) {
    const previous = await provider.stripe(`checkout/sessions/${contract.sessionId}`, null, 'GET');
    if (previous.status === 'open') return { url: previous.url };
    if (previous.status === 'complete') throw new ApiError(409, 'Confirmación pendiente: no vuelvas a pagar', 'PAYMENT_PENDING');
  }
  const attempt = contract.sessionId || 'initial';
  const remote = await provider.stripe('checkout/sessions', {
    mode: 'subscription', customer_email: user.email,
    client_reference_id: contract.id, 'metadata[contractId]': contract.id,
    'subscription_data[metadata][contractId]': contract.id,
    'line_items[0][price]': process.env.STRIPE_PRICE_ID, 'line_items[0][quantity]': '1',
    success_url: `${config.url}/#subscription`, cancel_url: `${config.url}/#subscription`
  }, 'POST', `contract-${contract.id}-${attempt}`);
  const saved = await Contract.findOneAndUpdate({ _id: contract._id, sessionId: contract.sessionId || { $exists: false } },
    { $set: { sessionId: remote.id, plan: config.plan, status: 'checkout' } }, { new: true });
  if (!saved) throw new ApiError(409, 'Reintenta recuperar la contratación', 'CHECKOUT_CONFLICT');
  return { url: remote.url };
}

// Always reconcile with the current provider snapshot instead of trusting event order.
async function reconcile(contractId) {
  const lease = crypto.randomUUID();
  const contract = await Contract.findOneAndUpdate({ _id: contractId,
    $or: [{ reconcileLeaseUntil: { $exists: false } }, { reconcileLeaseUntil: { $lt: new Date() } }]
  }, { $set: { reconcileLeaseId: lease, reconcileLeaseUntil: new Date(Date.now() + 120000) } }, { new: true });
  if (!contract) return { busy: true };
  try {
  if (!contract?.sessionId) return;
  const checkoutSession = await provider.stripe(`checkout/sessions/${contract.sessionId}`, null, 'GET');
  if (checkoutSession.client_reference_id !== contract.id || checkoutSession.metadata?.contractId !== contract.id ||
    checkoutSession.currency !== contract.plan.currency || checkoutSession.amount_total !== contract.plan.amount ||
    checkoutSession.livemode !== (checkoutConfig().mode === 'live')) {
    throw new ApiError(400, 'Identidad o importe inválido', 'PAYMENT_MISMATCH');
  }
  if (checkoutSession.status === 'expired' && !contract.companyId) {
    await Contract.updateOne({ _id: contractId, companyId: { $exists: false } }, { $set: { status: 'expired' } });
    return;
  }
  if (checkoutSession.status !== 'complete' || !checkoutSession.subscription) return;
  const subId = typeof checkoutSession.subscription === 'string' ? checkoutSession.subscription : checkoutSession.subscription.id;
  const subscription = await provider.stripe(`subscriptions/${subId}`, null, 'GET');
  const item = subscription.items?.data?.[0];
  if (subscription.metadata?.contractId !== contract.id || subscription.items?.data?.length !== 1 ||
    item.quantity !== 1 || item.price.unit_amount !== contract.plan.amount ||
    item.price.currency !== contract.plan.currency || item.price.recurring?.interval !== contract.plan.interval ||
    !Number.isFinite(subscription.current_period_end)) {
    throw new ApiError(400, 'Suscripción inválida', 'PAYMENT_MISMATCH');
  }
  const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice?.id;
  const invoice = invoiceId ? await provider.stripe(`invoices/${invoiceId}`, null, 'GET') : null;
  const chargeId = typeof invoice?.charge === 'string' ? invoice.charge : invoice?.charge?.id;
  const charge = chargeId ? await provider.stripe(`charges/${chargeId}`, null, 'GET') : null;
  const hold = contract.holdReason || (charge?.disputed ? 'dispute' : charge?.amount_refunded > 0 ? 'refund' : undefined);
  const invoiceSubscription = typeof invoice?.subscription === 'string' ? invoice.subscription : invoice?.subscription?.id;
  const paid = invoice?.paid === true && invoice.amount_paid === contract.plan.amount && invoice.currency === contract.plan.currency && invoiceSubscription === subscription.id;
  const active = !hold && subscription.status === 'active' && paid && subscription.current_period_end * 1000 > Date.now();
  if (!contract.companyId && !active) return;
  await transaction(async session => {
    const current = await Contract.findById(contractId).session(session);
    if (current.reconcileLeaseId !== lease || current.reconcileLeaseUntil <= new Date()) throw new ApiError(409, 'Reconciliación en curso', 'RECONCILE_CONFLICT');
    const effectiveActive = active && !current.holdReason;
    if (!current.companyId && !effectiveActive) return;
    if (!current.companyId && effectiveActive) {
      // All provisioning writes commit together; a retry cannot create a second company.
      const user = await User.findById(current.ownerId).session(session);
      if (!user?.emailVerifiedAt) throw new ApiError(409, 'Cuenta no apta para activación', 'ACTIVATION_CONFLICT');
      if (user.companyId) await Membership.updateOne({ userId: user._id, companyId: user.companyId },
        { $setOnInsert: { role: user.role, commercial: user.commercialAccount } }, { upsert: true, session });
      const [company] = await Company.create([{ name: current.companyName }], { session });
      await Membership.create([{ userId: user._id, companyId: company._id, role: 'ADMIN' }], { session });
      await User.updateOne({ _id: user._id }, { $set: { companyId: company._id, role: 'ADMIN', commercialAccount: true } }, { session });
      current.companyId = company._id;
      current.pendingOwnerId = undefined;
      await enqueue(user.email, 'Empresa activada', 'Tu empresa está activa. Inicia sesión para configurarla.', session);
    }
    current.status = effectiveActive ? 'active' : subscription.status === 'canceled' ? 'canceled' : 'restricted';
    if (hold) current.holdReason = hold;
    current.subscriptionId = subscription.id;
    current.customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    current.periodEnd = new Date(subscription.current_period_end * 1000);
    current.cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
    current.lastReconciledAt = new Date();
    if (paid) await Payment.updateOne({ invoiceId }, { $setOnInsert: { contractId: current._id,
      amount: invoice.amount_paid, currency: invoice.currency, status: 'paid',
      receiptUrl: typeof invoice.hosted_invoice_url === 'string' && invoice.hosted_invoice_url.startsWith('https://') ? invoice.hosted_invoice_url : undefined
    } }, { upsert: true, session });
    if (current.isModified('status')) {
      await require('../audit/audit.model').create([{ userId: current.ownerId, companyId: current.companyId,
        action: 'UPDATE', module: 'commercial', documentId: current.id,
        previousData: { status: contract.status }, newData: { status: current.status }
      }], { session });
      if (current.status !== 'active') {
        const owner = await User.findById(current.ownerId).session(session);
        await enqueue(owner.email, 'Suscripción restringida', 'Revisa tu suscripción y método de pago para recuperar el acceso.', session);
      }
    }
    await current.save({ session });
  });
  } finally {
    await Contract.updateOne({ _id: contractId, reconcileLeaseId: lease }, { $unset: { reconcileLeaseId: 1, reconcileLeaseUntil: 1 } });
  }
}

async function webhook(event) {
  await Event.updateOne({ providerId: event.id }, { $setOnInsert: { type: event.type } }, { upsert: true });
  const existing = await Event.findOne({ providerId: event.id });
  if (existing.status === 'processed') return { duplicate: true };
  const object = event.data.object;
  if (event.type === 'charge.refunded' || event.type.startsWith('charge.dispute.')) {
    const charge = event.type === 'charge.refunded' ? object : await provider.stripe(`charges/${encodeURIComponent(object.charge)}`, null, 'GET');
    const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id;
    const payment = invoiceId ? await Payment.findOne({ invoiceId }) : null;
    if (payment) {
      const reason = event.type === 'charge.refunded' ? 'refund' : 'dispute';
      await transaction(async session => {
        await Contract.updateOne({ _id: payment.contractId }, { $set: { status: 'restricted', holdReason: reason } }, { session });
        await Payment.updateOne({ _id: payment._id }, { $set: { status: reason === 'refund' ? 'refunded' : 'disputed' } }, { session });
        const affected = await Contract.findById(payment.contractId).session(session);
        await require('../audit/audit.model').create([{ userId: affected.ownerId, companyId: affected.companyId,
          action: 'UPDATE', module: 'commercial', documentId: affected.id, newData: { holdReason: reason }
        }], { session });
      });
    }
  }
  let contract = null;
  if (event.type.startsWith('checkout.session.')) contract = await Contract.findOne({ sessionId: object.id });
  else if (event.type.startsWith('customer.subscription.')) {
    contract = await Contract.findOne({ subscriptionId: object.id });
    if (!contract && mongoose.isValidObjectId(object.metadata?.contractId)) contract = await Contract.findById(object.metadata.contractId);
  } else if (event.type.startsWith('invoice.') && typeof object.subscription === 'string') {
    contract = await Contract.findOne({ subscriptionId: object.subscription });
    if (!contract) {
      const remote = await provider.stripe(`subscriptions/${encodeURIComponent(object.subscription)}`, null, 'GET');
      if (mongoose.isValidObjectId(remote.metadata?.contractId)) contract = await Contract.findById(remote.metadata.contractId);
    }
  }
  // Reconciliation is retryable. Store only non-sensitive event identity.
  if (contract) {
    const result = await reconcile(contract.id);
    if (result?.busy) throw new ApiError(503, 'Reconciliación en curso; reintenta', 'RECONCILE_BUSY');
    if (event.type === 'invoice.payment_failed') {
      const owner = await User.findById(contract.ownerId);
      await enqueue(owner.email, 'Pago no confirmado', 'El proveedor reportó un pago fallido. Revisa el método de pago en Mi suscripción; no contrates de nuevo para recuperar este proceso.', undefined, `${event.id}-payment-failed`);
    }
  }
  await Event.updateOne({ providerId: event.id }, { $set: { status: 'processed', processedAt: new Date() } });
  return { received: true };
}

async function setup(userId, data) {
  const contract = await getContract(userId);
  if (contract.status !== 'active' || !contract.companyId || contract.periodEnd <= new Date()) throw new ApiError(403, 'Suscripción restringida', 'SUBSCRIPTION_REQUIRED');
  if (typeof data.branchName !== 'string' || !data.branchName.trim() || data.branchName.length > 120) throw new ApiError(400, 'Nombre de sucursal inválido', 'INVALID_INPUT');
  return transaction(async session => {
    const current = await Contract.findOneAndUpdate({ _id: contract._id, configuredAt: { $exists: false } },
      { $set: { configuredAt: new Date() } }, { session });
    if (current) await Branch.create([{ companyId: contract.companyId, name: data.branchName.trim() }], { session });
    return { configured: true };
  });
}

async function invite(userId, email, requestedRole = 'VENTAS', ip) {
  const user = await User.findById(userId);
  if (!user?.active || !user.companyId) throw new ApiError(403, 'Se requiere una empresa activa', 'COMPANY_REQUIRED');
  if (user.role === 'SUPER_ADMIN') throw new ApiError(403, 'La cuenta de plataforma no puede invitar usuarios', 'INVITATION_FORBIDDEN');
  const company = await Company.findOne({ _id: user.companyId, active: { $ne: false } });
  if (!company) throw new ApiError(404, 'Empresa no encontrada o inactiva', 'COMPANY_NOT_FOUND');

  const roleName = String(requestedRole || '').trim().toUpperCase();
  if (!INVITABLE_ROLES.includes(roleName) || !await require('../roles/role.service').findByName(roleName)) {
    throw new ApiError(400, 'Rol de invitación inválido', 'INVALID_INVITE_ROLE');
  }

  const membership = await Membership.findOne({ userId, companyId: user.companyId });
  const hasCommercialContract = Boolean(await Contract.exists({ companyId: user.companyId }));
  const commercial = hasCommercialContract || (membership ? membership.commercial : user.commercialAccount);
  let contract = null;
  if (commercial) {
    if (user.firstAccess?.mode) throw new ApiError(403, 'Esta cuenta no puede invitar usuarios', 'INVITATION_FORBIDDEN');
    contract = await Contract.findOne({ ownerId: userId, companyId: user.companyId, status: 'active', periodEnd: { $gt: new Date() } });
    if (!contract) throw new ApiError(403, 'Suscripción restringida o cuenta sin permisos de propietario', 'SUBSCRIPTION_REQUIRED');
  } else {
    const issuerRole = await require('../roles/role.service').findByName(membership?.role || user.role);
    if (!issuerRole || !(issuerRole.permissions.includes('*') || issuerRole.permissions.includes('users.create'))) {
      throw new ApiError(403, 'Sin permiso para invitar usuarios', 'FORBIDDEN');
    }
  }

  email = String(email).trim().toLowerCase();
  const raw = crypto.randomBytes(32).toString('hex');
  await transaction(async session => {
    const [token] = await Token.create([{ hash: hash(raw), kind: 'invite', email, role: roleName, companyId: user.companyId,
      invitedBy: userId, commercial: Boolean(commercial), expiresAt: new Date(Date.now() + 7 * 86400000) }], { session });
    await enqueue(email, 'Invitación al ERP', `${process.env.FRONTEND_URL || 'http://localhost:19006'}/#invite?token=${raw}`, session);
    await require('../audit/audit.model').create([{ userId, companyId: user.companyId, action: 'CREATE',
      module: 'users.invitations', documentId: String(token._id), newData: { role: roleName }, ip }], { session });
  });
  return { sent: true, companyName: company.name, role: roleName };
}

async function acceptInvite(userId, raw) {
  return transaction(async session => {
    const user = await User.findById(userId).session(session);
    if (!user?.active || user.role === 'SUPER_ADMIN') throw new ApiError(403, 'Cuenta no apta para invitación', 'INVITE_ACCOUNT');
    const token = await Token.findOneAndUpdate({ hash: hash(raw), kind: 'invite', email: user.email,
      usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { session });
    if (!token) throw new ApiError(400, 'Invitación inválida', 'INVALID_TOKEN');
    const company = await Company.findOne({ _id: token.companyId, active: { $ne: false } }).session(session);
    if (!company || !INVITABLE_ROLES.includes(token.role)) throw new ApiError(409, 'La empresa o el rol de la invitación ya no están disponibles', 'INVITATION_UNAVAILABLE');
    const commercial = await isCommercialInvitation(token, session);
    if (await Membership.exists({ userId, companyId: token.companyId }).session(session)) throw new ApiError(409, 'Ya perteneces a esta empresa', 'MEMBERSHIP_EXISTS');
    if (commercial) {
      const contract = await Contract.findOneAndUpdate({ companyId: token.companyId, status: 'active', periodEnd: { $gt: new Date() },
        $expr: { $lt: ['$seats', '$plan.maxUsers'] } }, { $inc: { seats: 1 } }, { session });
      if (!contract) throw new ApiError(409, 'Límite de usuarios o suscripción restringida', 'USER_LIMIT');
    }
    if (user.companyId && String(user.companyId) !== String(token.companyId)) {
      const previousCompany = await Company.findOne({ _id: user.companyId, active: { $ne: false } }).session(session);
      if (previousCompany && Membership.schema.path('role').enumValues.includes(user.role)) {
        const previousMembership = await Membership.findOne({ userId, companyId: user.companyId }).session(session);
        const previousCommercial = previousMembership ? previousMembership.commercial :
          Boolean(await Contract.exists({ companyId: user.companyId }).session(session));
        await Membership.updateOne({ userId, companyId: user.companyId },
          { $setOnInsert: { role: user.role, commercial: previousCommercial } }, { upsert: true, session });
      }
    }
    await Membership.create([{ userId, companyId: token.companyId, role: token.role, commercial }], { session });
    await User.updateOne({ _id: userId }, { $set: { companyId: token.companyId, role: token.role,
      commercialAccount: commercial, ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) } }, { session });
    await require('../audit/audit.model').create([{ userId, companyId: token.companyId, action: 'CREATE',
      module: 'users.memberships', documentId: String(userId), newData: { role: token.role, source: 'invitation' } }], { session });
    // An invitation signup has no checkout; abandon that unused initial draft only.
    await Contract.updateOne({ pendingOwnerId: userId, status: 'pending', sessionId: { $exists: false } },
      { $set: { status: 'expired' }, $unset: { pendingOwnerId: 1 } }, { session });
    return { accepted: true };
  });
}

async function completeInvite(raw, data) {
  return transaction(async session => {
    const token = await Token.findOneAndUpdate({ hash: hash(raw), kind: 'invite', usedAt: { $exists: false },
      expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { new: true, session });
    if (!token) throw new ApiError(400, 'Invitación inválida o vencida', 'INVALID_TOKEN');
    if (await User.exists({ email: token.email }).session(session)) {
      throw new ApiError(409, 'La cuenta ya existe; inicia sesión y acepta la invitación', 'INVITEE_ACCOUNT_EXISTS');
    }
    const company = await Company.findOne({ _id: token.companyId, active: { $ne: false } }).session(session);
    if (!company || !INVITABLE_ROLES.includes(token.role)) throw new ApiError(409, 'La empresa o el rol de la invitación ya no están disponibles', 'INVITATION_UNAVAILABLE');
    const commercial = await isCommercialInvitation(token, session);
    const passwordHash = await require('bcryptjs').hash(data.password, 12);
    if (commercial) {
      const contract = await Contract.findOneAndUpdate({ companyId: token.companyId, status: 'active', periodEnd: { $gt: new Date() },
        $expr: { $lt: ['$seats', '$plan.maxUsers'] } }, { $inc: { seats: 1 } }, { session });
      if (!contract) throw new ApiError(409, 'Límite de usuarios o suscripción restringida', 'USER_LIMIT');
    }
    const emailVerifiedAt = new Date(); // Possession of the single-use invitation proves control of this email.
    const [user] = await User.create([{ name: data.name.trim(), email: token.email, passwordHash, role: token.role,
      companyId: token.companyId, commercialAccount: commercial, emailVerifiedAt }], { session });
    await Membership.create([{ userId: user._id, companyId: token.companyId, role: token.role, commercial }], { session });
    await require('../audit/audit.model').create([{ userId: user._id, companyId: token.companyId, action: 'CREATE',
      module: 'users.memberships', documentId: String(user._id), newData: { role: token.role, source: 'invitation' } }], { session });
    await Contract.updateOne({ pendingOwnerId: user._id, status: 'pending', sessionId: { $exists: false } },
      { $set: { status: 'expired' }, $unset: { pendingOwnerId: 1 } }, { session });
    return { accepted: true, email: user.email };
  });
}

async function portal(userId) {
  const contract = await getContract(userId);
  if (!contract.customerId) throw new ApiError(409, 'No hay suscripción activa', 'CONTRACT_STATE');
  const result = await provider.stripe('billing_portal/sessions', { customer: contract.customerId, return_url: `${checkoutConfig().url}/#subscription` });
  return { url: result.url };
}

async function cancel(userId) {
  const contract = await getContract(userId);
  if (!contract.subscriptionId) throw new ApiError(409, 'No hay suscripción', 'CONTRACT_STATE');
  await provider.stripe(`subscriptions/${contract.subscriptionId}`, { cancel_at_period_end: 'true' }, 'POST', `cancel-${contract.id}`);
  await reconcile(contract.id);
  return { cancellation: 'period_end' };
}

async function sweep() {
  const expired = await Contract.find({ status: 'active', periodEnd: { $lte: new Date() } }).select('_id');
  for (const row of expired) {
    await transaction(async session => {
      const changed = await Contract.findOneAndUpdate({ _id: row._id, status: 'active', periodEnd: { $lte: new Date() } },
        { $set: { status: 'restricted' } }, { session });
      if (!changed) return;
      const owner = await User.findById(changed.ownerId).session(session);
      await enqueue(owner.email, 'Vigencia finalizada', 'La vigencia de tu suscripción finalizó. Revisa pagos para recuperar el acceso.', session);
      await require('../audit/audit.model').create([{ action: 'UPDATE', module: 'commercial', companyId: changed.companyId,
        userId: changed.ownerId, documentId: changed.id, newData: { status: 'restricted', reason: 'expired' }
      }], { session });
    });
  }
  const contracts = await Contract.find({ sessionId: { $exists: true }, status: { $ne: 'canceled' } });
  let failed = 0;
  for (const contract of contracts) {
    try { await reconcile(contract.id); } catch { failed++; }
  }
  return { checked: contracts.length, failed };
}

module.exports = { registerAccount, ensureContract, newContract, memberships, switchCompany, sendVerification, verify, getContract, subscriptionView, checkout, reconcile, webhook, setup, invite, acceptInvite, completeInvite, portal, cancel, sweep };
