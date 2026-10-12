const crypto = require('crypto');
const { checkoutConfig } = require('./catalog');
const { ApiError } = require('../../utils/ApiError');

async function stripe(path, params, method = 'POST', idempotencyKey) {
  const { key } = checkoutConfig();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': '2024-06-20',
      ...(method !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(method !== 'GET' ? { body: new URLSearchParams(params) } : {})
  });
  if (!response.ok) throw new ApiError(502, 'Proveedor de pagos no disponible', 'PAYMENT_PROVIDER_ERROR');
  return response.json();
}

function verifyWebhook(raw, signature) {
  const config = checkoutConfig();
  if (!Buffer.isBuffer(raw)) throw new ApiError(400, 'Cuerpo original requerido', 'INVALID_EVENT');
  const parts = String(signature || '').split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  if (!/^\d+$/.test(timestamp || '') || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new ApiError(400, 'Firma inválida', 'INVALID_SIGNATURE');
  }
  const expected = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.`).update(raw).digest();
  const valid = parts.filter(p => p.startsWith('v1=')).some(p => {
    const hex = p.slice(3);
    return /^[a-f0-9]{64}$/.test(hex) && crypto.timingSafeEqual(expected, Buffer.from(hex, 'hex'));
  });
  if (!valid) throw new ApiError(400, 'Firma inválida', 'INVALID_SIGNATURE');
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { throw new ApiError(400, 'Evento inválido', 'INVALID_EVENT'); }
  if (!event.id || typeof event.type !== 'string' || !event.data?.object || event.livemode !== (config.mode === 'live')) {
    throw new ApiError(400, 'Evento inválido', 'INVALID_EVENT');
  }
  return event;
}

module.exports = { stripe, verifyWebhook };
