import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTrendbars,ctraderId,parseCtraderId,lightSymbols,TIMEFRAMES,PROTO} from '../edge/ctrader-protocol.mjs';
import worker from '../edge/ctrader-worker.mjs';
const origin='https://tradingwise.vercel.app';
const env={CTRADER_CLIENT_ID:'test-app',CTRADER_CLIENT_SECRET:'fake-not-a-credential',CTRADER_SESSION_KEY:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',CTRADER_REDIRECT_URI:origin+'/api/ctrader/oauth/callback',DB:{}};
test('cTrader account+symbol IDs cannot inject arbitrary URL/path',()=>{
 assert.equal(ctraderId('123','456'),'CTRADER:123:456');assert.deepEqual(parseCtraderId('CTRADER:123:456'),{accountId:'123',symbolId:'456'});
 assert.throws(()=>parseCtraderId('CTRADER:https://evil.test'),/Invalid/);assert.throws(()=>ctraderId('123','../../foo'),/Invalid/);
});
test('trendbar delta precision/ordering matches cTrader documentation',()=>{
 const rows=[{utcTimestampInMinutes:1500,low:100000,deltaOpen:12000,deltaHigh:25000,deltaClose:15000,volume:42},{utcTimestampInMinutes:1440,low:100000,deltaOpen:2000,deltaHigh:3000,deltaClose:1000,volume:9}];
 const b=normalizeTrendbars(rows,'1m',Date.UTC(2026,0,1));assert.equal(b.length,2);assert.equal(b[1].open,1.12);assert.equal(b[1].high,1.25);assert.equal(b[1].close,1.15);assert.equal(b[1].volume,42);assert.equal(b[0].time,1440*60);
});
test('invalid OHLC cannot enter chart and unsupported timeframe rejected',()=>{
 const b=normalizeTrendbars([{utcTimestampInMinutes:90,low:100000,deltaHigh:10,deltaClose:11,deltaOpen:22}], '1m');assert.equal(b.length,0);
 assert.throws(()=>normalizeTrendbars([],'2h'),/Unsupported/);
 assert.equal(TIMEFRAMES['1h'].period,9);assert.equal(PROTO.TRENDBARS_REQ,2137);
});
test('catalog honors account ID and actual provider symbols',()=>{
 const b=lightSymbols({symbol:[{symbolId:1234,symbolName:'XAUUSD',description:'Gold',enabled:true}]},'999');
 assert.equal(b[0].id,'CTRADER:999:1234');assert.equal(b[0].provider,'CTRADER');
});
test('health does not expose client credentials',async()=>{
 const r=await worker.fetch(new Request(origin+'/api/ctrader/health'),env);const j=await r.json();assert.equal(j.configured,true);assert.equal(j.scope,'accounts');assert.equal(JSON.stringify(j).includes('fake-not-a-credential'),false);
});
test('OAuth start requests read-only accounts permission and sets HttpOnly CSRF state',async()=>{
 const r=await worker.fetch(new Request(origin+'/api/ctrader/oauth/start'),env);assert.equal(r.status,302);const u=new URL(r.headers.get('location'));assert.equal(u.searchParams.get('scope'),'accounts');assert.equal(u.searchParams.get('redirect_uri'),env.CTRADER_REDIRECT_URI);assert.equal(u.searchParams.get('state')?.length>10,true);
 assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal(r.headers.get('location').includes(env.CTRADER_CLIENT_SECRET),false);
});
test('callback rejects mismatched state without token exchange',async()=>{
 const request=new Request(origin+'/api/ctrader/oauth/callback?state=bad&code=fake',{headers:{cookie:'tw_ctrader_state=good'}});
 const r=await worker.fetch(request,env);assert.equal(r.status,400);assert.match((await r.json()).error,/state validation/);
});
test('session cookie required for private broker endpoints',async()=>{
 for(const path of ['/api/ctrader/accounts','/api/ctrader/symbols?account=999','/api/ctrader/candles?symbol=CTRADER:999:1234']){
  const r=await worker.fetch(new Request(origin+path),env);assert.equal(r.status,401);
 }
});