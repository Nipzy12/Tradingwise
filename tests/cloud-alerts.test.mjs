import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import alerts,{validateRule,closedCandles,checkRule,runCron,flushOutbox} from '../edge/alerts-worker.mjs';
import {seededDemo} from './fixtures/synthetic.mjs';

function database(){
 const db=new DatabaseSync(':memory:');
 for(const sql of readFileSync(new URL('../migrations/0001_cloud_alerts.sql',import.meta.url),'utf8').split(';'))if(sql.trim())db.exec(sql);
 const bind=(q,params=[])=>({bind(...values){return bind(q,values)},run:async()=>db.prepare(q).run(...params),all:async()=>({results:db.prepare(q).all(...params)}),first:async()=>db.prepare(q).get(...params)});
 return {DB:{prepare:sql=>bind(sql)}};
}
function fixture(tf='5m',count=170){
 const bars=seededDemo('XAUUSD',tf,count);
 return {bars:bars.map(b=>({openTime:new Date(b.time*1000).toISOString(),...b})),candles:bars};
}
const mkRule=(symbol='BIQUOTE:XAUUSD')=>({id:'44444444-4444-4444-4444-444444444444',symbol,interval:'5m',types:JSON.stringify(['SMC_ENTRY_BUY','SMC_ENTRY_SELL','SMC_NEW_BUY_PLAN','SMC_NEW_SELL_PLAN']),settings:JSON.stringify(validateRule({symbol,types:['SMC_ENTRY_BUY']}).settings),active:1,cursor:0});
const req=(path,method='GET',body,token)=>new Request('https://worker.test'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
test('validates free-tier Biquote-only rules and settings without arbitrary URLs',()=>{
 const rule=validateRule({symbol:'BIQUOTE:XAUUSD',interval:'5m',types:['SMC_ENTRY_BUY']});
 assert.equal(rule.symbol,'BIQUOTE:XAUUSD');assert.deepEqual(rule.types,['SMC_ENTRY_BUY']);
 assert.throws(()=>validateRule({symbol:'BINANCE:BTCUSDT',types:['SMC_ENTRY_BUY']}),/BIQUOTE/);
 assert.throws(()=>validateRule({symbol:'BIQUOTE:XAUUSD',interval:'1m',types:['SMC_ENTRY_BUY']}),/interval/i);
 assert.throws(()=>validateRule({symbol:'BIQUOTE:XAUUSD',types:['UNKNOWN']}),/types/i);
});
test('filters open candle and future candle, sorts and deduplicates',()=>{
 const now=Math.floor(Date.now()/1000);
 const closed=Math.floor(now/300)*300-600;
 const input={bars:[{openTime:new Date((closed+300)*1000).toISOString(),open:1,high:2,low:.5,close:1.5,isOpen:true},
 {openTime:new Date(closed*1000).toISOString(),open:1,high:2,low:.5,close:1.1},
 {openTime:new Date(closed*1000).toISOString(),open:1,high:2,low:.5,close:1.4}]};
 const out=closedCandles(input,'5m',now);assert.equal(out.length,1);assert.equal(out[0].close,1.4);
});
test('first cron invocation baselines historical candle instead of replaying historical alerts',async()=>{
 const env=database(),rule=mkRule(),b=fixture();
 await env.DB.prepare('INSERT INTO alert_rules(id,symbol,interval,types,settings,active,cursor,created_at)VALUES(?,?,?,?,?,?,?,?)').bind(rule.id,rule.symbol,rule.interval,rule.types,rule.settings,1,0,Date.now()).run();
 const fetchFn=async()=>new Response(JSON.stringify(b),{status:200});
 const out=await runCron(env,{now:Date.now()+30000,fetchFn});
 assert.equal(out[0].status,'baselined');
 const next=await runCron(env,{now:Date.now()+30000,fetchFn});assert.equal(next[0].status,'unchanged');
 const count=await env.DB.prepare('SELECT COUNT(*) AS c FROM alert_events').first();assert.equal(count.c,0);
});
test('alert API denies modifications without admin secret',async()=>{
 const env=database();const r=await alerts.fetch(req('/api/alerts/rules','POST',{symbol:'BIQUOTE:XAUUSD',types:['SMC_ENTRY_BUY']}),env);
 assert.equal(r.status,401);
});
test('secret-protected rule creation and retrieval uses D1',async()=>{
 const env={...database(),ADMIN_TOKEN:'a'.repeat(48)};
 let r=await alerts.fetch(req('/api/alerts/rules','POST',{symbol:'BIQUOTE:XAUUSD',interval:'5m',types:['SMC_ENTRY_BUY']},'a'.repeat(48)),env);
 assert.equal(r.status,201);
 r=await alerts.fetch(req('/api/alerts/rules','GET',null,'a'.repeat(48)),env);const data=await r.json();assert.equal(data.items.length,1);
 r=await alerts.fetch(req('/api/alerts/rules','GET',null,'b'.repeat(48)),env);assert.equal(r.status,401);
});
test('outbox signs HTTP POST and marks delivered; duplicates do not resend',async()=>{
 const env={...database(),WEBHOOK_URL:'https://example.org/alerts',WEBHOOK_SECRET:'s'.repeat(48)};
 await env.DB.prepare('INSERT INTO alert_events (id,rule_id,candle_time,payload,status,attempts,next_try,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('event-1','rule-1',1,JSON.stringify({id:'event-1'}),'pending',0,0,Date.now()).run();
 let calls=0;const fetchFn=async(url,init)=>{calls++;assert.equal(url,'https://example.org/alerts');assert.equal(init.headers['idempotency-key'],'event-1');assert.match(init.headers['x-lumavun-signature-256'],/^sha256=[a-f0-9]{64}$/);return new Response('OK',{status:200})};
 await flushOutbox(env,{now:Date.now(),fetchFn});await flushOutbox(env,{now:Date.now(),fetchFn});
 assert.equal(calls,1);assert.equal((await env.DB.prepare('SELECT status FROM alert_events WHERE id=?').bind('event-1').first()).status,'delivered');
});
test('HTTP errors queue retries and eventually fail without duplicate downstream IDs',async()=>{
 const env={...database(),WEBHOOK_URL:'https://example.org/alerts',WEBHOOK_SECRET:'s'.repeat(48)};
 await env.DB.prepare('INSERT INTO alert_events(id,rule_id,candle_time,payload,status,attempts,next_try,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('event-1','rule-1',1,'{"id":"event-1"}','pending',0,0,0).run();
 const fetchFn=async()=>new Response('No',{status:503});
 for(let i=0;i<5;i++)await flushOutbox(env,{now:Date.now()+i*1e7,fetchFn});
 assert.equal((await env.DB.prepare('SELECT status FROM alert_events WHERE id=?').bind('event-1').first()).status,'failed');
});