const fs = require('fs');
(async () => {
  try {
    if (!process.env.RENDER_API_KEY) throw new Error('RENDER_KEY_REQUIRED');
    async function api(path) {
      const response = await fetch('https://api.render.com/v1' + path, { headers: { Authorization: 'Bearer ' + process.env.RENDER_API_KEY }, signal: AbortSignal.timeout(30000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('RENDER_HTTP_' + response.status);
      return response.json();
    }
    const listed = await api('/services?name=proyectoerp-api&limit=100');
    const matches = listed.map(item => item.service).filter(service => service.name === 'proyectoerp-api' && service.serviceDetails?.url === 'https://proyectoerp-api.onrender.com');
    if (matches.length !== 1) throw new Error('RENDER_DESTINATION_AMBIGUOUS');
    const prefix = '/services/' + encodeURIComponent(matches[0].id) + '/env-vars/';
    const mongo = await api(prefix + 'MONGODB_URI');
    const origins = await api(prefix + 'CORS_ORIGINS');
    const frontend = await api(prefix + 'FRONTEND_URL');
    let sameDestination = null;
    if (mongo?.value && process.env.LOCAL_DATABASE_ENV_FILE) {
      const local = require('dotenv').parse(fs.readFileSync(process.env.LOCAL_DATABASE_ENV_FILE));
      const a = new URL(mongo.value), b = new URL(local.MONGODB_URI);
      const database = uri => decodeURIComponent(uri.pathname.slice(1)) || 'test';
      sameDestination = a.hostname === b.hostname && database(a) === database(b);
    }
    const allowed = (origins?.value || frontend?.value || '').split(',').map(value => value.trim().replace(/\/+$/, ''));
    console.log(JSON.stringify({ ok: true, service: matches[0].name, mongoConfigured: Boolean(mongo?.value), mongoMatchesLocalDestination: sameDestination, localhost8086Authorized: allowed.includes('http://localhost:8086'), frontendConfigured: Boolean(frontend?.value) }));
  } catch (error) {
    console.error(/^(RENDER_KEY_REQUIRED|RENDER_DESTINATION_AMBIGUOUS|RENDER_HTTP_\d{3})$/.test(error.message) ? error.message : 'RENDER_AUDIT_FAILED'); process.exitCode = 1;
  } finally { delete process.env.RENDER_API_KEY; }
})();
