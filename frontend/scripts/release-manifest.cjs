const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
const output = path.join(root, 'frontend/dist');
const manifestPath = path.join(output, 'release.json');
const assets = Object.fromEntries(files(output).filter(file => file !== manifestPath).sort().map(file => [path.relative(output, file).replaceAll('\\', '/'), digest(file)]));
let commit = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
const sourceFiles = [...files(path.join(root, 'frontend/src')), ...files(path.join(root, 'backend/src')), path.join(root, 'frontend/App.js'), path.join(root, 'package-lock.json')].sort();
const sourceHash = crypto.createHash('sha256').update(sourceFiles.map(file => path.relative(root, file).replaceAll('\\', '/') + ':' + digest(file)).join('\n')).digest('hex');
fs.writeFileSync(manifestPath, JSON.stringify({ commit, sourceHash, builtAt: new Date().toISOString(), api: 'https://proyectoerp-api.onrender.com/api/v1', assets }, null, 2) + '\n');
console.log('Release manifest generated with ' + Object.keys(assets).length + ' asset hashes');
