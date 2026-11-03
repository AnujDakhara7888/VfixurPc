const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('../backend/node_modules/pg');

if (process.env.VFIXURPC_DEPLOY !== '1') throw new Error('Set VFIXURPC_DEPLOY=1 to deploy offers.');
const common = ['--project=vfixurpc', '--region=us-central1'];
const describe = () => JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'vfixurpc-backend', ...common, '--format=json'], { encoding: 'utf8' }));

(async () => {
  const service = describe();
  const database = service.spec.template.spec.containers[0].env.find(row => row.name === 'DATABASE_URL')?.value;
  if (!database) throw new Error('DATABASE_URL is unavailable; migration stopped.');
  const db = new Client({ connectionString: database, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '8s'");
    for (const migration of [
      '20260917-production-schema-guard.sql',
      '20260916-offers-and-promotional-push.sql',
    ]) {
      await db.query(fs.readFileSync(path.join(__dirname, '../backend/migrations', migration), 'utf8'));
    }
    const requiredColumns = await db.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (table_name, column_name) IN (
        ('users', 'referred_by_user_id'),
        ('users', 'referral_discount_used_at'),
        ('users', 'promotional_push_opt_in'),
        ('bookings', 'referral_discount_percent'),
        ('service_requests', 'return_delivery_fee_total'),
        ('invoices', 'original_filename'),
        ('invoices', 'uploaded_by')
      )
    `);
    if (requiredColumns.rows.length !== 7) throw new Error('Required production columns are missing; deployment stopped.');
    const tables = await db.query("SELECT relname, relrowsecurity FROM pg_class WHERE oid IN ('public.offers'::regclass,'public.offer_claims'::regclass) ORDER BY relname");
    if (tables.rows.length !== 2 || tables.rows.some(row => !row.relrowsecurity)) throw new Error('Offer tables must exist with row-level security enabled.');
    const caps = await db.query("SELECT count(*)::int AS n FROM offers WHERE maximum_discount_cap NOT IN (0,150,250)");
    if (caps.rows[0].n) throw new Error('An invalid offer cap was created.');
    await db.query('COMMIT');
    console.log('Applied and verified the private offers migration.');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }

  execFileSync('gcloud', ['run', 'deploy', 'vfixurpc-backend', ...common,
    '--source=' + path.join(__dirname, '../backend'), '--no-traffic', '--tag=offers-update', '--quiet'], { stdio: 'inherit' });
  const staged = describe();
  const tagged = staged.status.traffic.find(row => row.tag === 'offers-update')?.url;
  if (!tagged) throw new Error('Staged tag URL was not returned.');
  const response = await fetch(tagged + '/api/v1/pickup-slots', { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !Array.isArray(await response.json())) throw new Error('Staged backend smoke test failed.');
  console.log('Staged backend smoke test passed:', tagged);
  execFileSync('gcloud', ['run', 'services', 'update-traffic', 'vfixurpc-backend', ...common, '--to-latest', '--quiet'], { stdio: 'inherit' });
  console.log('Promoted the verified backend revision.');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
