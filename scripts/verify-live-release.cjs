const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('../backend/node_modules/pg');
const PDFDocument = require('../backend/node_modules/pdfkit');

// Explicit opt-in: this creates and removes only its own disposable test data.
if (process.env.VFIXURPC_LIVE_CHECK !== '1') {
  throw new Error('Set VFIXURPC_LIVE_CHECK=1 to verify the production release.');
}
if (process.env.VFIXURPC_ALLOW_STAFF_TEST_ALERTS !== '1') {
  throw new Error('Registration and customer uploads now notify staff. Use verify-notification-release.cjs for silent checks, or explicitly set VFIXURPC_ALLOW_STAFF_TEST_ALERTS=1.');
}
const api = 'https://vfixurpc-backend-160921860149.us-central1.run.app/api/v1';
const service = JSON.parse(execFileSync('gcloud', [
  'run', 'services', 'describe', 'vfixurpc-backend', '--region=us-central1',
  '--project=vfixurpc', '--format=json',
], { encoding: 'utf8' }));
const db = new Client({
  connectionString: service.spec.template.spec.containers[0].env.find(e => e.name === 'DATABASE_URL').value,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
const suffix = randomBytes(6).toString('hex');
const username = `release_check_${suffix}`;
const password = randomBytes(24).toString('base64url');
const ticketId = randomUUID();
let userId;
let token;

async function request(route, { method = 'GET', body, status = 200, binary = false } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(api + route, {
    method, headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, status, `${method} ${route}: unexpected HTTP status`);
  if (status === 204) return;
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
}

(async () => {
  await db.connect();
  try {
    const session = await request('/auth/register', {
      method: 'POST', status: 201,
      body: {
        username, password, name: 'Disposable release verification',
        email: `${username}@example.invalid`,
        phone: '+91000' + String(Number.parseInt(suffix.slice(0, 6), 16) % 10000000).padStart(7, '0'),
      },
    });
    userId = session.user.id;
    token = session.accessToken;
    const me = await request('/users/me');
    assert.equal(me.id, userId);
    assert.equal(me.passwordHash, undefined);
    assert.equal(me.refreshToken, undefined);
    await request('/service-requests/my');
    await request('/devices');
    await request('/notifications');
    await request('/notifications/unread-count');
    await request('/admin/dashboard', { status: 403 });
    await request('/invoices', { status: 403 });
    console.log('PASS: registration, customer API reads, hidden credentials, staff permission guards');

    // Insert a synthetic ticket directly to avoid notifying real staff of a booking.
    await db.query(`INSERT INTO service_requests
      (id, service_request_number, customer_id, status, pickup_address, pickup_slot_date, pickup_slot_time)
      VALUES ($1,$2,$3,'REQUEST_RECEIVED','Disposable verification record',CURRENT_DATE + 1,'14:00 - 14:30')`,
    [ticketId, `TEST-${suffix}`, userId]);
    await db.query(`INSERT INTO status_history
      (service_request_id,from_status,to_status,changed_by,notes)
      VALUES ($1,'REQUEST_RECEIVED','DIAGNOSING',$2,'Disposable verification')`, [ticketId, userId]);
    const ticket = await request(`/service-requests/${ticketId}`);
    assert.equal(ticket.id, ticketId);
    await request(`/service-requests/${ticketId}/invoice`);
    const media = fs.readFileSync(path.join(__dirname, '../mobile/assets/icon.png'));
    const photo = new FormData();
    photo.append('file', new Blob([media], { type: 'image/png' }), 'verification.png');
    photo.append('caption', 'Disposable release verification');
    const attachment = await request(`/service-requests/${ticketId}/attachments`, {
      method: 'POST', body: photo, status: 201,
    });
    assert.deepEqual(await request(`/attachments/${attachment.id}/file`, { binary: true }), media);
    console.log('PASS: migrated ticket/history reads and authenticated media round trip');

    // Elevate only this generated account; no real staff credentials are used.
    await db.query("UPDATE users SET role='OPERATIONS' WHERE id=$1 AND username=$2", [userId, username]);
    const staffSession = await request('/auth/login', { method: 'POST', body: { username, password } });
    token = staffSession.accessToken;
    const pdf = await new Promise(resolve => {
      const document = new PDFDocument();
      const chunks = [];
      document.on('data', chunk => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.text('Disposable release verification. Not a customer invoice.');
      document.end();
    });
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'verification.pdf');
    form.append('invoiceNumber', `TEST-${suffix}`);
    form.append('documentKind', 'Service report');
    const invoice = await request(`/service-requests/${ticketId}/invoice/upload`, {
      method: 'POST', body: form, status: 201,
    });
    assert.deepEqual(await request(`/invoices/${invoice.id}/pdf`, { binary: true }), pdf);
    await request('/auth/logout', { method: 'POST', status: 204 });
    console.log('PASS: staff PDF upload/download and logout');
  } finally {
    // Exact random identifiers keep cleanup isolated from all existing records.
    if (!userId) {
      userId = (await db.query('SELECT id FROM users WHERE username=$1', [username])).rows[0]?.id;
    }
    if (userId) {
      await db.query('BEGIN');
      try {
        await db.query('DELETE FROM notifications WHERE user_id=$1 OR service_request_id=$2', [userId, ticketId]);
        await db.query('DELETE FROM ticket_attachments WHERE service_request_id=$1', [ticketId]);
        await db.query('DELETE FROM invoices WHERE service_request_id=$1', [ticketId]);
        await db.query('DELETE FROM status_history WHERE service_request_id=$1', [ticketId]);
        await db.query('DELETE FROM service_requests WHERE id=$1 AND customer_id=$2', [ticketId, userId]);
        await db.query('DELETE FROM users WHERE id=$1 AND username=$2', [userId, username]);
        await db.query('COMMIT');
        console.log('Removed disposable verification account, ticket, media, documents and notifications.');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }
    await db.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
