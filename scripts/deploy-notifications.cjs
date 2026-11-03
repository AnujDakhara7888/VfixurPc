const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { Client } = require('../backend/node_modules/pg');
const webpush = require('../backend/node_modules/web-push');

if (process.env.VFIXURPC_DEPLOY !== '1') throw new Error('Set VFIXURPC_DEPLOY=1 to deploy this release.');
const common = ['--project=vfixurpc', '--region=us-central1'];
const describe = () => JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'vfixurpc-backend', ...common, '--format=json'], { encoding: 'utf8' }));
(async () => {
  const service = describe();
  const envRows = service.spec.template.spec.containers[0].env;
  if (envRows.some(row => row.valueFrom)) throw new Error('Secret references require a preserving deployment configuration.');
  const env = Object.fromEntries(envRows.map(row => [row.name, row.value ?? '']));
  if (!env.WEB_PUSH_PUBLIC_KEY || !env.WEB_PUSH_PRIVATE_KEY) {
    const keys = webpush.generateVAPIDKeys();
    env.WEB_PUSH_PUBLIC_KEY = keys.publicKey;
    env.WEB_PUSH_PRIVATE_KEY = keys.privateKey;
  }
  env.WEB_PUSH_SUBJECT = 'mailto:hriday@vfixurpc.com';
  const db = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query(fs.readFileSync(path.join(__dirname, '../backend/migrations/20260908-web-push.sql'), 'utf8'));
    const check = await db.query("SELECT relrowsecurity AS protected FROM pg_class WHERE oid='public.web_push_subscriptions'::regclass");
    if (!check.rows[0]?.protected) throw new Error('Subscription table RLS must be enabled');
    const grants = await db.query("SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='web_push_subscriptions' AND grantee IN ('anon','authenticated','PUBLIC')");
    if (grants.rows[0].n) throw new Error('Unexpected public subscription grants');
    await db.query('COMMIT');
    console.log('Applied additive private web-push table migration.');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vfixurpc-deploy-'));
  fs.chmodSync(temp, 0o700);
  try {
    const file = path.join(temp, 'env.json');
    fs.writeFileSync(file, JSON.stringify(env), { mode: 0o600 });
    execFileSync('gcloud', ['run', 'deploy', 'vfixurpc-backend', ...common,
      '--source=' + path.join(__dirname, '../backend'), '--env-vars-file=' + file,
      '--no-traffic', '--tag=notification-update', '--quiet'], { stdio: 'inherit' });
    console.log('Staged revision:', describe().status.latestReadyRevisionName);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
