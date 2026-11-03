const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('../backend/node_modules/pg');
if (process.env.VFIXURPC_DEPLOY !== '1') throw new Error('Set VFIXURPC_DEPLOY=1 to stage account fixes.');
const common = ['--project=vfixurpc', '--region=us-central1'];
(async () => {
  const service = JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'vfixurpc-backend', ...common, '--format=json'], {encoding:'utf8'}));
  const env = Object.fromEntries(service.spec.template.spec.containers[0].env.map(row => [row.name, row.value]));
  const db = new Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query(fs.readFileSync(path.join(__dirname,'../backend/migrations/20260909-account-recovery.sql'),'utf8'));
    const check = await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.password_resets'::regclass");
    if (!check.rows[0]?.relrowsecurity) throw new Error('Recovery table must have RLS');
    const grants = await db.query("SELECT count(*)::int n FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='password_resets' AND grantee IN ('anon','authenticated','PUBLIC')");
    if (grants.rows[0].n) throw new Error('Unexpected recovery table grants');
    await db.query('COMMIT');
    console.log('Applied additive account recovery migration with restricted public access.');
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
  execFileSync('gcloud',['run','deploy','vfixurpc-backend',...common,'--source='+path.join(__dirname,'../backend'),'--no-traffic','--tag=account-update','--quiet'],{stdio:'inherit'});
})().catch(error => { console.error(error.message);process.exitCode=1; });
