// Private operator command. Updates only CORS_ORIGINS, preserving its existing entries.
(async () => {
  try {
    if (!process.env.RENDER_API_KEY) throw new Error('RENDER_KEY_REQUIRED');
    async function api(path, method = 'GET', body, allowMissing = false) {
      const response = await fetch('https://api.render.com/v1' + path, {
        method, headers: { Authorization: 'Bearer ' + process.env.RENDER_API_KEY, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000)
      });
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) throw new Error('RENDER_HTTP_' + response.status);
      return response.status === 204 ? null : response.json();
    }
    const listed = await api('/services?name=proyectoerp-api&limit=100');
    const matches = listed.map(item => item.service).filter(service => service.name === 'proyectoerp-api'
      && service.serviceDetails?.url === 'https://proyectoerp-api.onrender.com');
    if (matches.length !== 1) throw new Error('RENDER_DESTINATION_AMBIGUOUS');
    const service = matches[0];
    const path = '/services/' + encodeURIComponent(service.id);
    const current = await api(path + '/env-vars/CORS_ORIGINS', 'GET', undefined, true);
    const fallback = current?.value ? null : await api(path + '/env-vars/FRONTEND_URL', 'GET', undefined, true);
    const origins = (current?.value || fallback?.value || '').split(',').map(value => value.trim().replace(/\/+$/, '')).filter(Boolean);
    const origin = 'http://localhost:8086';
    if (origins.includes(origin)) { console.log(JSON.stringify({ ok: true, changed: false, service: service.name, origin, note: 'Verify active deployment and CORS' })); return; }
    origins.push(origin);
    await api(path + '/env-vars/CORS_ORIGINS', 'PUT', { value: [...new Set(origins)].join(',') });
    const deploy = await api(path + '/deploys', 'POST', { deployMode: 'deploy_only' });
    console.log(JSON.stringify({ ok: true, changed: true, service: service.name, origin, deploymentId: deploy.id, status: deploy.status }));
  } catch (error) {
    const safe = /^(RENDER_KEY_REQUIRED|RENDER_DESTINATION_AMBIGUOUS|RENDER_HTTP_\d{3})$/;
    console.error(safe.test(error.message) ? error.message : 'RENDER_CORS_UPDATE_FAILED'); process.exitCode = 1;
  } finally { delete process.env.RENDER_API_KEY; }
})();
