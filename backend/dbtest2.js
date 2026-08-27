require('dotenv').config();
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: false, connectionTimeoutMillis: 10000 });
c.connect()
  .then(() => { console.log('CONNECTED (no ssl)'); return c.query('select 1'); })
  .then(r => { console.log('QUERY OK', r.rows); c.end(); })
  .catch(e => { console.error('FAILED code:', e.code); console.error('FAILED message:', e.message); process.exit(1); });
