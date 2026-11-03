const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createECDH } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Client } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcrypt');
const api = process.env.NOTIFICATION_API;
if (!api || process.env.VFIXURPC_LIVE_CHECK !== '1') throw new Error('Explicit API and VFIXURPC_LIVE_CHECK=1 required');
const service = JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'vfixurpc-backend', '--region=us-central1', '--project=vfixurpc', '--format=json'], { encoding: 'utf8' }));
const db = new Client({ connectionString: service.spec.template.spec.containers[0].env.find(e => e.name === 'DATABASE_URL').value, ssl: { rejectUnauthorized: false } });
const users = [randomUUID(), randomUUID()];
const events = [randomUUID(), randomUUID()];
const suffix = randomBytes(6).toString('hex');
const password = randomBytes(24).toString('base64url');
async function request(route, token, method = 'GET', body, status = 200) {
  const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, method + ' ' + route);
  if (status === 204) return;
  return response.json();
}
(async () => {
  await db.connect();
  try {
    // Insert only generated verification users. Registration would notify real staff.
    for (let i = 0; i < users.length; i++) {
      await db.query('INSERT INTO users (id,name,email,username,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [users[i], 'Notification verification', `notify_${suffix}_${i}@example.invalid`, `notify_${suffix}_${i}`, '+91000' + String(parseInt(suffix.slice(0, 5), 16) * 2 + i).padStart(7, '0'), await bcrypt.hash(password, 10), i ? 'CUSTOMER' : 'OPERATIONS']);
      await db.query("INSERT INTO notifications(id,user_id,type,status,message) VALUES ($1,$2,'PUSH','PENDING','Disposable notification verification')", [events[i], users[i]]);
    }
    const staff = await request('/auth/login', null, 'POST', { username: `notify_${suffix}_0`, password });
    const customer = await request('/auth/login', null, 'POST', { username: `notify_${suffix}_1`, password });
    if (process.env.VFIXURPC_CHECK_PLACES === '1') {
      await request('/places/autocomplete', null, 'POST', { input: 'Vile Parle Mumbai' }, 401);
      await request('/places/autocomplete', customer.accessToken, 'POST', { input: 'ab' }, 400);
      await request('/places/autocomplete', customer.accessToken, 'POST', { input: 'a'.repeat(201) }, 400);
      const suggestions = await request('/places/autocomplete', customer.accessToken, 'POST', { input: 'Vile Parle Mumbai' }, 201);
      assert.ok(suggestions.suggestions.length > 0);
      assert.ok(suggestions.suggestions.every(s => typeof s.address === 'string' && typeof s.id === 'string'));
      assert.equal(suggestions.key, undefined);
      console.log('PASS: authenticated live Google suggestions, input validation and manual-fallback contract.');
    }
    await request('/notifications/delivery-settings', null, 'GET', undefined, 401);
    await request('/notifications/delivery-settings', customer.accessToken, 'GET', undefined, 403);
    const settings = await request('/notifications/delivery-settings', staff.accessToken);
    assert.equal(settings.webPush.enabled, true);
    assert.equal(Buffer.from(settings.webPush.publicKey, 'base64url').length, 65);
    assert.equal(settings.webPush.privateKey, undefined);
    assert.equal((await request('/notifications', staff.accessToken)).length, 1);
    await request('/notifications/' + events[1] + '/read', staff.accessToken, 'PATCH');
    assert.equal((await request('/notifications/unread-count', customer.accessToken)).count, 1);
    const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
    const subscription = { endpoint: 'https://web.push.apple.com/verification-' + suffix, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
    await request('/notifications/web-push', customer.accessToken, 'POST', subscription, 403);
    await request('/notifications/web-push', staff.accessToken, 'POST', { ...subscription, endpoint: 'https://127.0.0.1/internal' }, 400);
    assert.equal((await request('/notifications/web-push/test', staff.accessToken, 'POST', undefined, 201)).accepted, 0);
    await request('/notifications/web-push', staff.accessToken, 'POST', subscription, 201);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM web_push_subscriptions WHERE user_id=$1', [users[0]])).rows[0].n, 1);
    // No push is sent to the synthetic endpoint.
    await request('/auth/logout', staff.accessToken, 'POST', undefined, 204);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM web_push_subscriptions WHERE user_id=$1', [users[0]])).rows[0].n, 0);
    console.log('PASS: configured public key, staff/customer guards, isolated inbox, SSRF rejection, subscription persistence and logout cleanup. No real notifications sent.');
  } finally {
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM notifications WHERE user_id = ANY($1::uuid[])', [users]);
      await db.query('DELETE FROM users WHERE id = ANY($1::uuid[]) AND username LIKE $2', [users, `notify_${suffix}_%`]);
      await db.query('COMMIT');
      console.log('Removed disposable verification users and events.');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { await db.end(); }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
