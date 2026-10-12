const LOGIN_TIMEOUT_MS = 90000;

async function loginRequest(client, email, password) {
  const response = await client.post('/auth/login', { email, password }, { timeout: LOGIN_TIMEOUT_MS });
  const data = response.data?.data;
  if (response.data?.success !== true || !data?.accessToken || !data?.refreshToken || !data?.user) {
    const error = new Error('Respuesta de autenticación incompleta');
    error.response = { status: 502, data: { message: 'El servidor no pudo confirmar tu acceso. Intenta nuevamente.' } };
    throw error;
  }
  return data;
}

function isSessionRequest(url = '') {
  return !url.includes('/auth/') || url === '/auth/me';
}

// This small transport is shared with the Node regression tests.
/* global module */
module.exports = { loginRequest, isSessionRequest, LOGIN_TIMEOUT_MS };
