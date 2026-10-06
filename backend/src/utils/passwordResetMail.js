const env = require('../config/env');
const { ApiError } = require('./ApiError');

async function sendPasswordReset(email, token) {
  if (env.env === 'test') return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) throw new ApiError(503, 'Recuperación de contraseña no disponible temporalmente', 'MAIL_UNAVAILABLE');
  const url = new URL(env.frontendUrl);
  url.searchParams.set('resetToken', token);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Restablecer contraseña de ERP',
        text: `Para cambiar tu contraseña abre este enlace:\n${url.toString()}\n\nCaduca en una hora. Si no lo solicitaste, ignora este correo.` }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Mail delivery failed');
  } catch {
    throw new ApiError(503, 'No se pudo enviar el correo de recuperación. Inténtalo más tarde.', 'MAIL_UNAVAILABLE');
  }
}
module.exports = { sendPasswordReset };
