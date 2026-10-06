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

test('CORS production allows configured domains and local frontend only explicitly', async () => {
  const previousEnv = env.env, previousOrigins = env.corsOrigins;
  try {
    env.env = 'production';
    env.corsOrigins = ['https://erp.example.com', 'http://localhost:8086'];
    const productionApp = createApp();
    for (const origin of env.corsOrigins) {
      const response = await request(productionApp).options('/api/v1/auth/login').set('Origin', origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
    expect((await request(productionApp).get('/health').set('Origin', 'https://erp.example.com.evil.invalid')).headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(productionApp).get('/health').set('Origin', 'http://localhost:8081')).headers['access-control-allow-origin']).toBeUndefined();
  } finally { env.env = previousEnv; env.corsOrigins = previousOrigins; }
});
