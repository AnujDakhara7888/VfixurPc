const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { DataSource } = require('../backend/node_modules/typeorm');
const bcrypt = require('../backend/node_modules/bcrypt');
const { WarrantyService } = require('../backend/dist/warranty/warranty.service');
const api = process.env.WARRANTY_API;
if (!api || process.env.VFIXURPC_LIVE_CHECK !== '1') throw new Error('Explicit WARRANTY_API and VFIXURPC_LIVE_CHECK=1 required');
const service = JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'vfixurpc-backend', '--project=vfixurpc', '--region=us-central1', '--format=json'], { encoding: 'utf8' }));
const env = Object.fromEntries(service.spec.template.spec.containers[0].env.map(e => [e.name, e.value]));
const db = new DataSource({ type: 'postgres', url: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, entities: [path.join(__dirname, '../backend/dist/**/*.entity.js'), path.join(__dirname, '../backend/dist/warranty/warranty.entities.js')], synchronize: false });
const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()], ticket = randomUUID(), suffix = randomBytes(6).toString('hex'), password = randomBytes(24).toString('hex');
const roles = ['CUSTOMER', 'CUSTOMER', 'OPERATIONS', 'TECHNICIAN'];
async function request(route, token, method = 'GET', body, status = 200) {
  const r = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, status, method + ' ' + route); return r.json();
}
(async () => {
  await db.initialize();
  try {
    for (let i = 0; i < users.length; i++) await db.query('INSERT INTO users(id,name,email,username,phone,password_hash,role) VALUES($1,$2,$3,$4,$5,$6,$7)', [users[i], 'Warranty verification', `warranty_${suffix}_${i}@example.invalid`, `warranty_${suffix}_${i}`, '+91000' + String(parseInt(suffix.slice(0, 5), 16) * 4 + i).padStart(7, '0'), await bcrypt.hash(password, 10), roles[i]]);
    await db.query("INSERT INTO service_requests(id,service_request_number,customer_id,status,pickup_address,pickup_slot_date,pickup_slot_time,quote_approved) VALUES($1,$2,$3,'REPAIR_COMPLETE','Disposable test address',current_date,'13:00 - 14:00',true)", [ticket, 'VFX-WARRANTY-' + suffix, users[0]]);
    const tokens = [];
    for (let i = 0; i < users.length; i++) tokens.push((await request('/auth/login', null, 'POST', { username: `warranty_${suffix}_${i}`, password })).accessToken);
    const route = '/service-requests/' + ticket;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const end = new Date(Date.parse(today + 'T00:00:00Z') + 86400000 * 30).toISOString().slice(0, 10);
    const policy = { startsOn: today, endsOn: end, coverage: 'Test repair only. Disposable verification policy.' };
    await request(route + '/warranty', null, 'GET', undefined, 401);
    await request(route + '/warranty', tokens[1], 'GET', undefined, 403);
    await request(route + '/warranty', tokens[0], 'PUT', policy, 403);
    await request(route + '/warranty', tokens[3], 'PUT', policy, 403);
    await request(route + '/warranty', tokens[2], 'PUT', { ...policy, startsOn: '2026-02-31' }, 400);
    await request(route + '/warranty', tokens[2], 'PUT', policy);
    assert.equal((await request(route + '/warranty', tokens[0])).canClaim, false);
    await request(route + '/customer-collection', tokens[0], 'POST', { receivedBy: 'Test collector' }, 403);
    await request(route + '/customer-collection', tokens[3], 'POST', { receivedBy: 'Test collector' }, 403);
    await request(route + '/customer-collection', tokens[2], 'POST', { receivedBy: ' ' }, 400);
    const collected = await request(route + '/customer-collection', tokens[2], 'POST', { receivedBy: 'Test collector' }, 201);
    assert.equal(collected.handoverMethod, 'CUSTOMER_COLLECTION'); assert.equal(collected.status, 'DELIVERED');
    await request(route + '/customer-collection', tokens[2], 'POST', { receivedBy: 'Test collector' }, 400);
    assert.equal((await request(route + '/warranty', tokens[0])).canClaim, true);
    // Only the claim creation service uses stubs: real creation would email all staff.
    let staffNotices = 0;
    const warranty = new WarrantyService(db, { notify: async () => {}, notifyAdmins: async () => { staffNotices++; } });
    const results = await Promise.allSettled([1, 2].map(() => warranty.request(ticket, { description: 'The test repair issue has returned.' }, { id: users[0], role: 'CUSTOMER' })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(staffNotices, 1);
    const claims = (await request(route + '/warranty', tokens[0])).claims;
    assert.equal(claims.length, 1); assert.equal(claims[0].serviceRequestId, ticket);
    await request(route + '/warranty/claims', tokens[0], 'POST', { description: 'A duplicate test claim' }, 400);
    await request(route + '/warranty/claims', tokens[1], 'POST', { description: 'Another account claim' }, 403);
    await request(route + '/warranty/claims/' + claims[0].id, tokens[0], 'PATCH', { status: 'IN_PROGRESS', note: 'Customer cannot approve' }, 403);
    await request(route + '/warranty/claims/' + claims[0].id, tokens[2], 'PATCH', { status: 'IN_PROGRESS', note: 'Accepted for test follow-up.' });
    await request(route + '/warranty/claims/' + claims[0].id, tokens[2], 'PATCH', { status: 'RESOLVED', note: 'Test follow-up resolved.' });
    assert.equal((await request(route + '/warranty', tokens[0])).claims[0].history.length, 3);
    assert.equal((await request(route, tokens[0])).status, 'DELIVERED');
    console.log('PASS live warranty permissions, issuance, collection audit, same-ticket claim, concurrent duplicate prevention, review and resolution. No real email or push sent.');
  } finally {
    await db.transaction(async em => {
      await em.query('DELETE FROM notifications WHERE user_id=ANY($1::uuid[])', [users]);
      await em.query('DELETE FROM status_history WHERE service_request_id=$1', [ticket]);
      await em.query('DELETE FROM service_requests WHERE id=$1 AND service_request_number=$2', [ticket, 'VFX-WARRANTY-' + suffix]);
      await em.query('DELETE FROM users WHERE id=ANY($1::uuid[]) AND username LIKE $2', [users, `warranty_${suffix}_%`]);
    });
    await db.destroy(); console.log('Removed disposable warranty verification records.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
