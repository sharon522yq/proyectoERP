const request = require('supertest');
const { createApp } = require('../src/app');
const env = require('../src/config/env');

describe('Endpoints de despliegue', () => {
  const app = createApp();

  test('GET / identifica el servicio y enlaza health, docs y API', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      service: 'erp-backend',
      health: '/health',
      documentation: '/docs',
      api: '/api/v1'
    });
  });

  test('GET /health permanece compatible con el health check de Render', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      success: true,
      service: 'erp-backend'
    }));
  });

  test('HEAD / responde 200 a la comprobación inicial de Render', async () => {
    const res = await request(app).head('/');

    expect(res.status).toBe(200);
  });

  test.each(['/api', '/api/v1'])('%s identifica la base de la API', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'ERP API disponible' });
  });

  test('favicon no genera ruido 404 en el navegador', async () => {
    const res = await request(app).get('/favicon.ico');

    expect(res.status).toBe(204);
  });

  test('CORS autoriza el origen configurado', async () => {
    const origin = env.corsOrigins[0];
    const res = await request(app).get('/health').set('Origin', origin);

    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  test('CORS no autoriza un origen desconocido', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
