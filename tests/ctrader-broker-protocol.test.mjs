import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../edge/ctrader-worker.mjs';

const origin='https://tradingwise.vercel.app';
function makeEnv() {
 const rows=new Map();
 return {
  CTRADER_CLIENT_ID:'test-client-id',
  CTRADER_CLIENT_SECRET:'fake-secret-do-not-expose',
  CTRADER_SESSION_KEY:Buffer.alloc(32,45).toString('base64'),
  CTRADER_REDIRECT_URI:origin+'/api/ctrader/oauth/callback',
  DB:{prepare(sql){
   if(sql.startsWith('SELECT 1 FROM'))return {all:async()=>({results:[]})};
   if(sql.startsWith('INSERT INTO'))return {bind(id,ciphertext,accessExpiry,sessionExpiry,updatedAt){
    return {run:async()=>{rows.set(id,{token_ciphertext:ciphertext,access_expires_at:accessExpiry,session_expires_at:sessionExpiry,updated_at:updatedAt});return {success:true}}}
   }};
   if(sql.startsWith('SELECT token_ciphertext'))return {bind(id){return {first:async()=>rows.get(id)||null}}};
   throw Error('Unknown test SQL');
  }}
 };
}
class BrokerSocket {
 constructor(endpoint,scenario) {this.endpoint=endpoint;this.scenario=scenario;this.events={};this.closed=false}
 accept(){}
 addEventListener(name,handler){this.events[name]=handler}
 send(text){
  const msg=JSON.parse(text),mode=this.endpoint.includes('live.')?'live':'demo';
  let payloadType,payload={};
  const error=this.scenario.errors?.[mode]?.[msg.payloadType];
  if(error) {
   payloadType=2142;
   payload={errorCode:error,description:this.scenario.descriptions?.[mode]?.[msg.payloadType]||'DO_NOT_EXPOSE_broker_description_or_tokens'};
   if(this.scenario.genericError)payloadType=50;
  }else if(msg.payloadType===2100)payloadType=2101;
  else if(msg.payloadType===2149){
   payloadType=2150;
   payload={ctidTraderAccount:this.scenario.accounts?.[mode]||[]};
  }else throw Error('Unexpected message: '+msg.payloadType);
  queueMicrotask(()=>{
   if(!this.closed)this.events.message?.({data:JSON.stringify({payloadType,payload,...(error&&this.scenario.omitErrorMsgId?{}:{clientMsgId:msg.clientMsgId})})});
  });
 }
 close(){this.closed=true}
}
async function runWithBroker(scenario,callback) {
 const env=makeEnv(),old=globalThis.fetch;
 globalThis.fetch=async (input,init={})=>{
  const url=String(input);
  if(url.startsWith('https://openapi.ctrader.com/apps/token'))return new Response(JSON.stringify({
   accessToken:'test-token-confidential',refreshToken:'test-refresh-confidential',expiresIn:25000
  }),{status:200,headers:{'content-type':'application/json'}});
  if(url.startsWith('https://demo.ctraderapi.com:5036/')||url.startsWith('https://live.ctraderapi.com:5036/')){
   assert.equal(init.headers?.upgrade,'websocket');
   return {status:101,webSocket:new BrokerSocket(url,scenario)};
  }
  throw Error('Unexpected fetch URL');
 };
 try{
  const start=await worker.fetch(new Request(origin+'/api/ctrader/oauth/start'),env);
  const state=new URL(start.headers.get('location')).searchParams.get('state');
  const originalState=start.headers.get('set-cookie').split(';')[0];
  const cb=await worker.fetch(new Request(origin+'/api/ctrader/oauth/callback?code=mock&state='+state,{headers:{cookie:originalState}}),env);
  assert.equal(cb.status,302);
  const cookie=(cb.headers.getSetCookie?.()||[cb.headers.get('set-cookie')]).join(';').match(/tw_ctrader=([-_A-Za-z0-9]{35,80})/)?.[0];
  assert.ok(cookie,'Session cookie missing after callback');
  return await callback({env,cookie});
 }finally{globalThis.fetch=old}
}

test('broker errors contain only documented error code and request stage, never descriptions',async()=>{
 await runWithBroker({errors:{demo:{2100:'CH_CLIENT_AUTH_FAILURE'},live:{2100:'CH_CLIENT_AUTH_FAILURE'}}},async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,502);
  const data=await r.json();
  assert.match(data.error,/APP_AUTH: CH_CLIENT_AUTH_FAILURE/);
  assert.doesNotMatch(JSON.stringify(data),/DO_NOT_EXPOSE|test-token|test-refresh|fake-secret/);
 });
});

test('list request reports ACCOUNT_LIST stage and safe code',async()=>{
 await runWithBroker({errors:{demo:{2149:'CH_ACCESS_TOKEN_INVALID'},live:{2149:'CH_ACCESS_TOKEN_INVALID'}}},async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,502);
  assert.match((await r.json()).error,/ACCOUNT_LIST: CH_ACCESS_TOKEN_INVALID/);
 });
});

test('account catalog discovers both demo and live accounts, de-duplicating by account ID',async()=>{
 const scenario={accounts:{
  demo:[{ctidTraderAccountId:'123',isLive:false,brokerTitle:'Sample Demo'}],
  live:[{ctidTraderAccountId:'234',isLive:true,brokerTitle:'Sample Live'}]
 }};
 await runWithBroker(scenario,async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.deepEqual(data.accounts.map(a=>a.accountId).sort(),['123','234']);
  assert.equal(data.accounts.find(a=>a.accountId==='234').isLive,true);
 });
});

test('one unavailable proxy does not hide the available account catalog',async()=>{
 const scenario={
  errors:{demo:{2100:'SERVER_IS_UNDER_MAINTENANCE'}},
  accounts:{live:[{ctidTraderAccountId:'234',isLive:true,brokerTitle:'Sample Live'}]}
 };
 await runWithBroker(scenario,async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.deepEqual(data.accounts.map(a=>a.accountId),['234']);
 });
});

test('protocol error sanitizes malicious provider code without leaking descriptions',async()=>{
 const scenario={errors:{demo:{2100:'INVALID`SENSITIVE`DATA'},live:{2100:'INVALID`SENSITIVE`DATA'}}};
 await runWithBroker(scenario,async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,502);
  assert.match((await r.json()).error,/APP_AUTH: UNKNOWN_ERROR/);
 });
});

test('cTrader protocol error without request ID is attributed to pending APP_AUTH',async()=>{
 const scenario={omitErrorMsgId:true,
  errors:{demo:{2100:'INVALID_REQUEST'},live:{2100:'INVALID_REQUEST'}},
  descriptions:{
   demo:{2100:'Message missing required fields: clientId. random-token=PRIVATE'},
   live:{2100:'Message missing required fields: clientId. random-token=PRIVATE'}
  }};
 await runWithBroker(scenario,async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,502);
  const data=await r.json();
  assert.match(data.error,/APP_AUTH: INVALID_REQUEST \(MISSING_CLIENTID\)/);
  assert.doesNotMatch(JSON.stringify(data),/PRIVATE|random-token|fake-secret|test-token/);
 });
});

test('cTrader account-list invalid request without ID exposes missing field label safely',async()=>{
 const scenario={omitErrorMsgId:true,
  errors:{demo:{2149:'INVALID_REQUEST'},live:{2149:'INVALID_REQUEST'}},
  descriptions:{
   demo:{2149:'Message missing required fields: accessToken SECRET_VALUE_NOT_PUBLIC'},
   live:{2149:'Message missing required fields: accessToken SECRET_VALUE_NOT_PUBLIC'}
  }};
 await runWithBroker(scenario,async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,502);
  const body=await r.json();
  assert.match(body.error,/ACCOUNT_LIST: INVALID_REQUEST \(MISSING_ACCESSTOKEN\)/);
  assert.doesNotMatch(JSON.stringify(body),/SECRET_VALUE_NOT_PUBLIC|test-token/);
 });
});

test('generic protocol errors payload type 50 are handled without timing out',async()=>{
 const scenario={genericError:true,omitErrorMsgId:true,
  errors:{demo:{2100:'INVALID_REQUEST'},live:{2100:'INVALID_REQUEST'}}};
 await runWithBroker(scenario,async({env,cookie})=>{
  const r=await worker.fetch(new Request(origin+'/api/ctrader/accounts',{headers:{cookie}}),env);
  assert.equal(r.status,502);
  assert.match((await r.json()).error,/APP_AUTH: INVALID_REQUEST/);
 });
});
