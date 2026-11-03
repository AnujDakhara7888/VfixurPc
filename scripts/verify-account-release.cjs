const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Client } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcrypt');
const api = process.env.ACCOUNT_API;
if (!api || process.env.VFIXURPC_LIVE_CHECK !== '1') throw new Error('Explicit ACCOUNT_API and VFIXURPC_LIVE_CHECK=1 required');
const service = JSON.parse(execFileSync('gcloud',['run','services','describe','vfixurpc-backend','--region=us-central1','--project=vfixurpc','--format=json'],{encoding:'utf8'}));
const env = Object.fromEntries(service.spec.template.spec.containers[0].env.map(row=>[row.name,row.value]));
const db = new Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const ids=[randomUUID(),randomUUID()], device=randomUUID(), suffix=randomBytes(6).toString('hex'), password=randomBytes(20).toString('hex');
const email=i=>`account_${suffix}_${i}@example.invalid`, username=i=>`account_${suffix}_${i}`;
async function request(route,token,method='GET',body,status=200){
  const r=await fetch(api+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  assert.equal(r.status,status,method+' '+route); return r.status===204?null:r.json();
}
(async()=>{
 await db.connect();
 try{
  for(let i=0;i<2;i++)await db.query(`INSERT INTO users(id,name,email,username,phone,password_hash,role) VALUES($1,$2,$3,$4,$5,$6,'CUSTOMER')`,[ids[i],i?'Test Bob':'Test Alice',email(i),username(i),'+91000'+String(parseInt(suffix.slice(0,5),16)*2+i).padStart(7,'0'),await bcrypt.hash(password,10)]);
  await db.query('INSERT INTO devices(id,customer_id,brand,model) VALUES($1,$2,$3,$4)',[device,ids[0],'HP','Pavilion']);
  const a=await request('/auth/login',null,'POST',{username:username(0),password});const b=await request('/auth/login',null,'POST',{username:username(1),password});
  assert.equal(a.user.name,'Test Alice');assert.equal(b.user.name,'Test Bob');
  assert.equal((await request('/users/me',a.accessToken)).id,ids[0]);assert.equal((await request('/users/me',b.accessToken)).id,ids[1]);
  assert.equal((await request('/devices',a.accessToken)).length,1);assert.equal((await request('/devices',b.accessToken)).length,0);
  await request('/devices/'+device,b.accessToken,'GET',undefined,404);
  assert.equal((await request('/service-requests/my',b.accessToken)).length,0);
  assert.equal((await request('/notifications',b.accessToken)).length,0);
  await request('/auth/forgot-password',null,'POST',{email:'invalid'},400);
  const settings=await request('/auth/recovery-settings');
  if(!settings.email)await request('/auth/forgot-password',null,'POST',{email:email(0)},503);
  const code='731984';const digest=createHmac('sha256',env.JWT_SECRET).update(email(0)+':'+code).digest('hex');
  await db.query("INSERT INTO password_resets(user_id,digest,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[ids[0],digest]);
  await request('/auth/reset-password',null,'POST',{email:email(0),code:'000000',password:'Changed-test-password'},400);
  assert.equal((await db.query('SELECT attempts FROM password_resets WHERE user_id=$1',[ids[0]])).rows[0].attempts,1);
  await request('/auth/reset-password',null,'POST',{email:email(0),code,password:'Changed-test-password'});
  await request('/users/me',a.accessToken,'GET',undefined,401);
  await request('/auth/refresh',null,'POST',{refreshToken:a.refreshToken},401);
  await request('/auth/login',null,'POST',{username:username(0),password},401);
  const changed=await request('/auth/login',null,'POST',{username:username(0),password:'Changed-test-password'});
  assert.equal(changed.user.id,ids[0]);
  await request('/auth/reset-password',null,'POST',{email:email(0),code,password:'Another-test-password'},400);
  assert.equal((await request('/notifications/native-settings',b.accessToken)).registered,false);
  await request('/notifications/native-test',b.accessToken,'POST',undefined,400);
  console.log('PASS live isolated accounts/names/devices/orders, cross-customer ID denial, reset validation/attempt count/single use, password change and access+refresh revocation. No email, SMS or push was sent.');
 }finally{
  await db.query('BEGIN');try{await db.query('DELETE FROM devices WHERE id=$1 AND customer_id=$2',[device,ids[0]]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[]) AND username LIKE $2',[ids,`account_${suffix}_%`]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
  console.log('Removed only the generated verification accounts, device and reset challenges.');
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
