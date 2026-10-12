const { Mail } = require('./models');
const { ApiError } = require('../../utils/ApiError');

function assertMailConfigured() {
  if (process.env.NODE_ENV === 'production' &&
    (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !process.env.FRONTEND_URL?.startsWith('https://'))) {
    throw new ApiError(503, 'Correo transaccional no configurado', 'MAIL_DISABLED');
  }
}

async function enqueue(to, subject, text, session, notificationId) {
  assertMailConfigured();
  if (notificationId) {
    await Mail.updateOne({ notificationId }, { $setOnInsert: { to, subject, text, nextAttemptAt: new Date() } }, { upsert: true, session });
    return;
  }
  await Mail.create([{ to, subject, text, nextAttemptAt: new Date() }], { session });
}

async function deliver() {
  assertMailConfigured();
  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) return { localOutbox: true };
  const rows = await Mail.find({ status: 'pending', nextAttemptAt: { $lte: new Date() } }).select('+text').limit(25);
  let sent = 0;
  for (const row of rows) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `mail-${row.id}` },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to: [row.to], subject: row.subject, text: row.text })
      });
      if (!response.ok) throw new Error('MAIL_PROVIDER_ERROR');
      await Mail.updateOne({ _id: row._id }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { text: 1 } });
      sent++;
    } catch {
      await Mail.updateOne({ _id: row._id }, { $inc: { attempts: 1 }, $set: { nextAttemptAt: new Date(Date.now() + 300000) } });
    }
  }
  return { sent };
}

module.exports = { assertMailConfigured, enqueue, deliver };
