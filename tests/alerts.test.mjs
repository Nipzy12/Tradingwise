import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {AlertStore} from '../server/alert-store.mjs';
import {AlertEngine,smcEvents,validateWebhookURL} from '../server/alerts.mjs';
import {computeSMC} from '../src/smc.js';
import {seededDemo} from './fixtures/synthetic.mjs';
import {buildServer} from '../server/index.mjs';

const bars=seededDemo('BTCUSDT','15m',600);
const settings={htfMode:'Off',qualityMode:'Longgar'};
const index=bars.findIndex((b,i)=>i>100&&i<450&&computeSMC(bars.slice(0,i+1),settings,'15m').events.some(e=>e.bar===i&&e.reason==='plan'));
assert.ok(index>100,'SMC test fixture should contain a plan');
const baseRule={symbol:'BINANCE:BTCUSDT',interval:'15m',settings,types:['SMC_NEW_BUY_PLAN','SMC_NEW_SELL_PLAN']};
function mockMarket(){
 let listener=null;
 return {catalog:{lookup:async()=>({id:'BINANCE:BTCUSDT'})},binance:{subscribe:(id,tf,cb)=>{listener=cb;return ()=>{listener=null}}},biquote:{subscribe:()=>{throw Error('unexpected Biquote')}},emit:msg=>listener?.(msg)};
}
function marketFetch(url){
 if(url.includes('/exchangeInfo'))return Promise.resolve({ok:true,json:async()=>({symbols:[{symbol:'BTCUSDT',status:'TRADING',baseAsset:'BTC',quoteAsset:'USDT'}]})});
 if(url.includes('/klines'))return Promise.resolve({ok:true,json:async()=>bars.slice(0,index).map(b=>[b.time*1000,String(b.open),String(b.high),String(b.low),String(b.close),String(b.volume)])});
 throw Error(`Unexpected mock market URL: ${url}`);
}
async function fixture({deliveryFetch=async()=>({ok:true}),webhookUrl='https://hooks.example.org/receiver',clock=()=>Date.now()}={}){
 const folder=await mkdtemp(join(tmpdir(),'lumavun-webhook-test-'));const store=new AlertStore(join(folder,'alerts.json'));const m=mockMarket();
 const engine=new AlertEngine({...m,fetchFn:marketFetch,deliveryFetch,store,webhookUrl,secret:'sample-secret',allowLocalWebhook:true,clock,logger:{error:()=>{}}});
 await engine.start();return {engine,store,m,folder,close:async()=>{await engine.close();await rm(folder,{recursive:true,force:true})}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));

test('Webhook URL validation enforces https and disallows embedded credentials',()=>{
 assert.throws(()=>validateWebhookURL('http://evil.example.com'),/HTTPS/);
 assert.throws(()=>validateWebhookURL('https://a:b@domain.com'),/credentials/);
 assert.throws(()=>validateWebhookURL('https://localhost/x'),/Local/);
 assert.equal(validateWebhookURL('https://hooks.example.com/a'),'https://hooks.example.com/a');
});
test('SMC event emitted ONLY for final closed candle, with stable id and entry values',()=>{
 const rule={...baseRule,id:'rule-123',types:['SMC_NEW_BUY_PLAN','SMC_NEW_SELL_PLAN']};
 const prev=smcEvents(rule,bars.slice(0,index));const next=smcEvents(rule,bars.slice(0,index+1));
 assert.equal(prev.every(e=>e.candleOpenTime!==new Date(bars[index].time*1000).toISOString()),true);
 assert.ok(next.some(e=>e.event.startsWith('SMC_NEW_')));assert.deepEqual(next,smcEvents(rule,bars.slice(0,index+1)));
 assert.ok(next.every(e=>e.confirmed&&e.id&&e.provider==='BINANCE'&&e.marketId==='BINANCE:BTCUSDT'));
});
test('Engine persists rule, emits on confirmed bar once, signs webhook and prevents duplicate delivery',async()=>{
 const requests=[];const f=await fixture({deliveryFetch:async(url,options)=>{requests.push({url,options});return {ok:true}}});
 try{
  const rule=await f.engine.createRule(baseRule);await tick();
  assert.equal(f.engine.active.size,1);assert.equal(f.store.data.rules[0].cursor,bars[index-1].time);
  f.m.emit({type:'candle',id:rule.symbol,interval:rule.interval,bar:{...bars[index],isOpen:true}});await tick();
  assert.equal(f.engine.listEvents().length,0,'do not fire until candle closes');
  f.m.emit({type:'candle',id:rule.symbol,interval:rule.interval,bar:{...bars[index],isOpen:false}});await tick();
  assert.equal(f.engine.listEvents().length,1);
  await f.engine.flush();assert.equal(requests.length,1);
  const req=requests[0],sha=createHmac('sha256','sample-secret').update(req.options.body).digest('hex');
  assert.equal(req.options.headers['X-Lumavun-Signature-256'],'sha256='+sha);
  assert.equal(req.options.headers['Idempotency-Key'],f.engine.listEvents()[0].id);
  assert.equal(JSON.parse(req.options.body).event,f.engine.listEvents()[0].event);
  f.m.emit({type:'candle',id:rule.symbol,interval:rule.interval,bar:{...bars[index],isOpen:false}});await tick();await f.engine.flush();
  assert.equal(f.engine.listEvents().length,1);assert.equal(requests.length,1);
  const readAgain=new AlertStore(join(f.folder,'alerts.json'));await readAgain.load();assert.equal(readAgain.data.rules.length,1);assert.equal(readAgain.data.events.length,1);
 }finally{await f.close()}
});
test('Webhook outbox retries failures then marks delivered, deletes rules cleanly',async()=>{
 let now=10000000,tries=0;const f=await fixture({clock:()=>now,deliveryFetch:async()=>{tries++;if(tries===1)return {ok:false,status:503};return {ok:true}}});
 try{
  const rule=await f.engine.createRule(baseRule);await tick();f.m.emit({type:'candle',id:rule.symbol,interval:rule.interval,bar:{...bars[index],isOpen:false}});await tick();
  assert.equal(f.store.data.outbox[0].status,'pending');assert.equal(f.store.data.outbox[0].attempts,1);
  now+=100000;await f.engine.flush();assert.equal(f.store.data.outbox[0].status,'delivered');assert.equal(tries,2);
  await f.engine.deleteRule(rule.id);assert.equal(f.engine.active.size,0);assert.equal(f.engine.listRules().length,0);
 }finally{await f.close()}
});
test('Protected HTTP alert endpoints reject unauthorized requests and allow rule management',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lumavun-http-alert-'));
 const m=mockMarket();
 const app=buildServer({root:process.cwd(),fetchFn:marketFetch,alertOptions:{store:new AlertStore(join(dir,'alerts.json')),adminToken:'test-token',webhookUrl:'',logger:{error:()=>{}}}});
 try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));await tick();
  const base='http://127.0.0.1:'+app.server.address().port;
  const noAuth=await fetch(base+'/api/alerts/rules');assert.equal(noAuth.status,401);
  const leak=await fetch(base+'/data/alerts.json');assert.equal(leak.status,403);
  const envLeak=await fetch(base+'/.env');assert.equal(envLeak.status,403);
  const headers={Authorization:'Bearer test-token','Content-Type':'application/json'};
  const status=await fetch(base+'/api/alerts/status',{headers});assert.equal(status.status,200);
  const bad=await fetch(base+'/api/alerts/rules',{method:'POST',headers,body:JSON.stringify({...baseRule,types:['__BAD__']})});assert.equal(bad.status,400);
  const created=await fetch(base+'/api/alerts/rules',{method:'POST',headers,body:JSON.stringify({...baseRule,active:false})});assert.equal(created.status,201);
  const id=(await created.json()).item.id;
  const all=await fetch(base+'/api/alerts/rules',{headers});assert.equal((await all.json()).items.length,1);
  const deleted=await fetch(base+'/api/alerts/rules/'+id,{method:'DELETE',headers});assert.equal(deleted.status,200);
  const remaining=await fetch(base+'/api/alerts/rules',{headers});assert.equal((await remaining.json()).items.length,0);
 }finally{await app.close();await rm(dir,{recursive:true,force:true})}
});
