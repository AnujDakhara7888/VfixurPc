const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const dotenv = require('../backend/node_modules/dotenv');
if (process.env.VFIXURPC_DEPLOY !== '1') throw new Error('Set VFIXURPC_DEPLOY=1 to stage this release');
const common = ['--project=vfixurpc', '--region=us-central1'];
const service = JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'vfixurpc-backend', ...common, '--format=json'], { encoding: 'utf8' }));
const rows = service.spec.template.spec.containers[0].env;
if (rows.some(row => row.valueFrom)) throw new Error('Preserve secret references before deploying');
const env = Object.fromEntries(rows.map(row => [row.name, row.value ?? '']));
env.GOOGLE_PLACES_API_KEY ||= dotenv.parse(fs.readFileSync(path.join(__dirname, '../mobile/.env'))).EXPO_PUBLIC_GOOGLE_PLACES_KEY;
if (!env.GOOGLE_PLACES_API_KEY) throw new Error('Configure a Places API key first');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfixurpc-address-'));
fs.chmodSync(temp, 0o700);
try {
  const file = path.join(temp, 'env.json');
  fs.writeFileSync(file, JSON.stringify(env), { mode: 0o600 });
  execFileSync('gcloud', ['run', 'deploy', 'vfixurpc-backend', ...common,
    '--source=' + path.join(__dirname, '../backend'), '--env-vars-file=' + file,
    '--no-traffic', '--tag=address-update', '--quiet'], { stdio: 'inherit' });
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
