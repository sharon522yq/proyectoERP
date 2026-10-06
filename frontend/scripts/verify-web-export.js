const fs = require('node:fs');
const path = require('node:path');
function verifyWebExport(root = path.resolve(__dirname, '..')) {
for (const file of ['dist/index.html', 'dist/_headers', 'wrangler.jsonc']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error('Missing export artifact: ' + file);
}
const wrangler = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
if (wrangler.assets?.not_found_handling !== 'single-page-application') throw new Error('Cloudflare SPA routing is required');
for (const file of ['public/_redirects', 'dist/_redirects']) {
  if (fs.existsSync(path.join(root, file))) throw new Error('Legacy SPA redirects conflict with Workers routing: ' + file);
}
const bundleDir = path.join(root, 'dist/_expo/static/js/web');
const bundles = fs.readdirSync(bundleDir).filter(file => file.endsWith('.js'));
if (!bundles.some(file => fs.readFileSync(path.join(bundleDir, file), 'utf8').includes('https://proyectoerp-api.onrender.com/api/v1'))) throw new Error('Render API missing from compiled export');
const config = fs.readFileSync(path.join(root, 'src/constants/config.js'), 'utf8');
if (/DEVELOPMENT_API_URL|EXPO_PUBLIC_USE_LOCAL_API|10\.0\.2\.2|localhost:4000/.test(config)) throw new Error('Local API fallback is forbidden');
}
if (require.main === module) {
  verifyWebExport();
  console.log('Web export artifacts and Render API verified');
}
module.exports = { verifyWebExport };
