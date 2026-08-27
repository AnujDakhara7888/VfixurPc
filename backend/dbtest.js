require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
c.connect()
  .then(() => { console.log('CONNECTED'); return c.query('select 1'); })
  .then(r => { console.log('QUERY OK', r.rows); c.end(); })
  .catch(e => { console.error('FAILED code:', e.code); console.error('FAILED message:', e.message); process.exit(1); });
