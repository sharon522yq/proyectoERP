const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const file of ['dist/index.html', 'dist/_headers', 'dist/_redirects', 'wrangler.jsonc']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error('Missing export artifact: ' + file);
}
JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
const bundleDir = path.join(root, 'dist/_expo/static/js/web');
const bundles = fs.readdirSync(bundleDir).filter(file => file.endsWith('.js'));
if (!bundles.some(file => fs.readFileSync(path.join(bundleDir, file), 'utf8').includes('https://proyectoerp-api.onrender.com/api/v1'))) throw new Error('Render API missing from compiled export');
const config = fs.readFileSync(path.join(root, 'src/constants/config.js'), 'utf8');
if (/DEVELOPMENT_API_URL|EXPO_PUBLIC_USE_LOCAL_API|10\.0\.2\.2|localhost:4000/.test(config)) throw new Error('Local API fallback is forbidden');
console.log('Web export artifacts and Render API verified');
