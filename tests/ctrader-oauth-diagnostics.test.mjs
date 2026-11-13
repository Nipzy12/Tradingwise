import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../edge/ctrader-worker.mjs';
const origin='https://tradingwise.vercel.app';
const key=Buffer.alloc(32,23).toString('base64');
const env=()=>({
 CTRADER_CLIENT_ID:'test-app-id',
 CTRADER_CLIENT_SECRET:'fake-secret-not-a-real-credential',
 CTRADER_SESSION_KEY:key,
 CTRADER_REDIRECT_URI:origin+'/api/ctrader/oauth/callback',
 DB:{prepare(sql){
  if(sql.startsWith('SELECT 1 FROM'))return {all:async()=>({results:[]})};
  if(sql.startsWith('INSERT INTO'))return {bind(){return {run:async()=>({success:true})}}};
  throw Error('Unexpected SQL')
 }}
});
async function stateCookie(environment){
 const r=await worker.fetch(new Request(origin+'/api/ctrader/oauth/start'),environment);
 assert.equal(r.status,302);
 const state=new URL(r.headers.get('location')).searchParams.get('state');
 return {state,cookie:'tw_ctrader_state='+state};
}
test('health verifies AES key, database and redirect URL without leaking credentials',async()=>{
 const e=env(),r=await worker.fetch(new Request(origin+'/api/ctrader/health'),e),b=await r.json();
 assert.equal(b.configured,true);
 assert.deepEqual(b.checks,{sessionKey:true,database:true,redirectUri:true});
 assert.doesNotMatch(JSON.stringify(b),/fake-secret|test-app-id/);
});
test('preflight blocks invalid session key before OAuth starts',async()=>{
 const e=env();e.CTRADER_SESSION_KEY='invalid-key';
 const r=await worker.fetch(new Request(origin+'/api/ctrader/health'),e),b=await r.json();
 assert.equal(b.configured,false);assert.equal(b.checks.sessionKey,false);
 const a=await worker.fetch(new Request(origin+'/api/ctrader/oauth/start'),e);
 assert.equal(a.status,503);assert.equal((await a.json()).code,'CONFIG_NOT_READY');
});
test('preflight reveals missing database table without leaking details',async()=>{
 const e=env();e.DB={prepare:()=>({all:async()=>{throw Error('no such table')}})};
 const r=await worker.fetch(new Request(origin+'/api/ctrader/health'),e);
 const b=await r.json();assert.equal(b.configured,false);assert.equal(b.checks.database,false);
});
test('token rejection shows safe provider error status and code',async()=>{
 const e=env(),{state,cookie}=await stateCookie(e),old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({errorCode:'invalid_grant',description:'secret-message'}),{status:400});
 try{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/oauth/callback?code=sample&state='+state,{headers:{cookie}}),e);
  const b=await r.json();assert.equal(r.status,502);assert.equal(b.code,'TOKEN_REJECTED');
  assert.equal(b.provider_code,'INVALID_GRANT');assert.equal(b.provider_status,400);
  assert.doesNotMatch(JSON.stringify(b),/secret-message|sample/);
 }finally{globalThis.fetch=old}
});
test('network failure is distinct from token rejection',async()=>{
 const e=env(),{state,cookie}=await stateCookie(e),old=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('Sensitive network trace')};
 try{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/oauth/callback?code=sample&state='+state,{headers:{cookie}}),e);
  assert.equal(r.status,502);assert.equal((await r.json()).code,'TOKEN_NETWORK_ERROR');
 }finally{globalThis.fetch=old}
});
test('session storage failure is not misreported as cTrader token rejection',async()=>{
 const e=env(),{state,cookie}=await stateCookie(e),old=globalThis.fetch;
 e.DB.prepare=sql=>sql.startsWith('SELECT')?{all:async()=>({results:[]})}:{bind:()=>({run:async()=>{throw Error('D1 write failed')}})};
 globalThis.fetch=async()=>new Response(JSON.stringify({accessToken:'not-public',refreshToken:'not-public',expiresIn:60}),{status:200});
 try{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/oauth/callback?code=sample&state='+state,{headers:{cookie}}),e);
  const b=await r.json();assert.equal(r.status,503);assert.equal(b.code,'SESSION_STORE_FAILED');assert.doesNotMatch(JSON.stringify(b),/not-public/);
 }finally{globalThis.fetch=old}
});
test('successful callback writes encrypted session and sets Secure HttpOnly cookie',async()=>{
 const e=env(),{state,cookie}=await stateCookie(e),old=globalThis.fetch;let cipher='';
 e.DB.prepare=sql=>sql.startsWith('SELECT')?{all:async()=>({results:[]})}:{bind:(id,value)=>{cipher=value;return{run:async()=>({success:true})}}};
 globalThis.fetch=async()=>new Response(JSON.stringify({accessToken:'not-public',refreshToken:'not-public',expiresIn:60}),{status:200});
 try{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/oauth/callback?code=sample&state='+state,{headers:{cookie}}),e);
  assert.equal(r.status,302);assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
  assert.match(cipher,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);assert.doesNotMatch(cipher,/not-public/);
 }finally{globalThis.fetch=old}
});

test('Cloudflare fetch uses supported manual redirect mode for token exchange',async()=>{
 const e=env(),{state,cookie}=await stateCookie(e),before=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async (url,options={})=>{
  requests++;
  assert.equal(new URL(url).origin,'https://openapi.ctrader.com');
  assert.equal(options.redirect,'manual');
  return new Response(JSON.stringify({accessToken:'not-a-real-token',refreshToken:'test-only',expiresIn:60}),{status:200});
 };
 try{
  const q=new URL(origin+'/api/ctrader/oauth/callback');q.searchParams.set('code','example-code');q.searchParams.set('state',state);
  const res=await worker.fetch(new Request(q,{headers:{cookie}}),e);
  assert.equal(res.status,302);
  assert.equal(requests,1);
  assert.equal(res.headers.get('location'),origin+'/?ctrader=connected');
  assert.doesNotMatch(String(res.headers),/not-a-real-token|test-only|fake-secret/);
 }finally{globalThis.fetch=before}
});
test('Unexpected token endpoint redirects are rejected without following or leaking credentials',async()=>{
 const e=env(),{state,cookie}=await stateCookie(e),before=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async (url,options={})=>{
  requests++;
  assert.equal(options.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://attacker.invalid/capture'}});
 };
 try{
  const u=new URL(origin+'/api/ctrader/oauth/callback');u.searchParams.set('code','example-code');u.searchParams.set('state',state);
  const r=await worker.fetch(new Request(u,{headers:{cookie}}),e);
  const result=await r.json();
  assert.equal(r.status,502);
  assert.equal(result.code,'TOKEN_REDIRECT_BLOCKED');
  assert.equal(requests,1);
  assert.doesNotMatch(JSON.stringify(result),/example-code|fake-secret|attacker\.invalid/);
 }finally{globalThis.fetch=before}
});
