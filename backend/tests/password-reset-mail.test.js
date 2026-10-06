jest.mock('../src/config/env', () => ({ env: 'production', frontendUrl: 'https://erp.example.com/?lang=es' }));
const { sendPasswordReset } = require('../src/utils/passwordResetMail');
const originalFetch = global.fetch;
const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.MAIL_FROM;
beforeEach(() => { process.env.RESEND_API_KEY = 'test-key'; process.env.MAIL_FROM = 'ERP <erp@example.com>'; global.fetch = jest.fn(); });
afterAll(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  if (originalFrom === undefined) delete process.env.MAIL_FROM; else process.env.MAIL_FROM = originalFrom;
});
test('envía enlace al frontend conservando parámetros', async () => {
  global.fetch.mockResolvedValue({ ok: true });
  await sendPasswordReset('user@example.com', 'token123');
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  const body = JSON.parse(options.body);
  expect(body.to).toEqual(['user@example.com']);
  expect(body.text).toContain('https://erp.example.com/?lang=es&resetToken=token123');
  expect(options.headers.Authorization).toBe('Bearer test-key');
});
test('configuración faltante rechaza sin enviar', async () => {
  delete process.env.RESEND_API_KEY;
  await expect(sendPasswordReset('user@example.com', 'token123')).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE' });
  expect(global.fetch).not.toHaveBeenCalled();
});
test('fallo del proveedor no expone detalles', async () => {
  global.fetch.mockResolvedValue({ ok: false });
  await expect(sendPasswordReset('user@example.com', 'token123')).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE' });
});
