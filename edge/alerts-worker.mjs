/** Tradingwise's bounded scheduled SMC engine. Cloudflare Workers Free + D1.
 * No simulated prices; no public rule management; no arbitrary webhook URLs.
 * Rules are BIQUOTE-only because Binance rejects Cloudflare egress (HTTP 403).
 * 5m+ candle-close polling, at most three SMC rules per account/Worker.
 * Requires D1 binding DB. Secrets ADMIN_TOKEN, WEBHOOK_URL, WEBHOOK_SECRET are optional;
 * without ADMIN_TOKEN all management is disabled, without WEBHOOK_URL delivery is disabled.
 */
import {computeSMC,smcSettings} from '../src/smc.js';

const PERIODS=Object.freeze({'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400});
const TYPES=Object.freeze(['SMC_ZONE_INVALIDATED','SMC_NEW_BUY_PLAN','SMC_NEW_SELL_PLAN','SMC_ENTRY_BUY','SMC_ENTRY_SELL','SMC_TAKE_PROFIT','SMC_STOP_LOSS']);
const MAX_RULES=3;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const bytes=x=>new TextEncoder().encode(x);
const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
export const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',bytes(value)));

async function authorized(request,env){
 const given=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32||!given||given.length>256)return false;
 const [a,b]=await Promise.all([sha256(given),sha256(env.ADMIN_TOKEN)]);
 // Hashes are fixed-length; do not early-return on an individual mismatched byte.
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export function validateRule(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fail('Invalid alert rule');
 const symbol=String(raw.symbol||'').toUpperCase(),interval=String(raw.interval||'5m');
 if(!/^BIQUOTE:[A-Z0-9_.-]{2,40}$/.test(symbol))throw fail('Free scheduled SMC supports BIQUOTE symbols only');
 if(!PERIODS[interval])throw fail('Allowed intervals: 5m,15m,30m,1h,4h,1d');
 if(!Array.isArray(raw.types)||!raw.types.length||raw.types.length>TYPES.length||raw.types.some(x=>!TYPES.includes(x)))throw fail('Invalid SMC alert types');
 if(raw.active!==undefined&&typeof raw.active!=='boolean')throw fail('active must be boolean');
 if(raw.settings!==undefined&&(typeof raw.settings!=='object'||Array.isArray(raw.settings)||!raw.settings))throw fail('Invalid indicator settings');
 const settings=smcSettings(raw.settings||{});
 // HTF data is reconstructed from fetched LTF history; require higher TF.
 const tfToSec={...PERIODS,'1m':60,'3m':180,'2h':7200,'1w':604800};
 if(settings.htfMode!=='Off'&&(tfToSec[settings.htfTF]||0)<=PERIODS[interval])throw fail('HTF must be higher than selected interval');
 return {symbol,interval,types:[...new Set(raw.types)],settings,active:raw.active!==false};
}
export function closedCandles(payload,interval,nowSeconds){
 if(!Array.isArray(payload?.bars))throw fail('Upstream OHLC response is missing bars',502);
 const group=new Map();
 for(const r of payload.bars){
  const time=Math.floor(Date.parse(r.openTime)/1000),open=Number(r.open),high=Number(r.high),low=Number(r.low),close=Number(r.close);
  if(!Number.isInteger(time)||time<=0||![open,high,low,close].every(x=>Number.isFinite(x)&&x>0)||low>Math.min(open,close)||high<Math.max(open,close))continue;
  if(r.isOpen===true||time+PERIODS[interval]>nowSeconds-3)continue;
  group.set(time,{time,open,high,low,close,volume:Number(r.volume??r.tickVolume)||0,isOpen:false});
 }
 return [...group.values()].sort((a,b)=>a.time-b.time).slice(-350);
}
const EVENT_TYPES={zoneRemoved:'SMC_ZONE_INVALIDATED',entry:null,plan:null,tp:'SMC_TAKE_PROFIT',sl:'SMC_STOP_LOSS'};
export async function extractSMCEvents(rule,bars){
 const output=computeSMC(bars,typeof rule.settings==='string'?JSON.parse(rule.settings):rule.settings,rule.interval);
 if(output.warning)return [];
 const last=bars.at(-1),at=bars.length-1;
 const ruleTypes=typeof rule.types==='string'?JSON.parse(rule.types):rule.types;
 const matched=[];
 for(const [sequence,e] of output.events.entries()){
  if(e.bar!==at)continue;
  const type=e.reason==='plan'?(e.side===1?'SMC_NEW_BUY_PLAN':'SMC_NEW_SELL_PLAN'):e.reason==='entry'?(e.side===1?'SMC_ENTRY_BUY':'SMC_ENTRY_SELL'):EVENT_TYPES[e.reason];
  if(!type||!ruleTypes.includes(type))continue;
  const key=[rule.id,last.time,e.reason,e.side??'',e.model??'',e.label??'',sequence].join('|');
  const id=(await sha256(key)).slice(0,32);
  matched.push({id,event:type,ruleId:rule.id,indicator:'SMC Entry Models PRO v5 (JavaScript adaptation)',marketId:rule.symbol,provider:'BIQUOTE',symbol:rule.symbol.split(':')[1],timeframe:rule.interval,candleOpenTime:new Date(last.time*1000).toISOString(),timestamp:new Date((last.time+PERIODS[rule.interval])*1000).toISOString(),confirmed:true,model:e.model||null,side:e.side===1?'BUY':e.side===-1?'SELL':null,entry:e.entry??null,sl:e.sl??null,tp:e.tp??null,price:e.price??last.close,label:e.label??null,candle:{open:last.open,high:last.high,low:last.low,close:last.close,volume:last.volume}});
 }
 return matched;
}
async function fetchRuleBars(rule,now,fetchFn){
 const symbol=rule.symbol.split(':')[1];
 const u=`https://biquote.io/api/${encodeURIComponent(symbol)}/ohlc?interval=${encodeURIComponent(rule.interval)}&limit=350`;
 const response=await fetchFn(u,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(11000)});
 if(!response.ok)throw fail(`Biquote HTTP ${response.status}`,502);
 return closedCandles(await response.json(),rule.interval,Math.floor(now/1000));
}
export async function checkRule(env,rule,{now=Date.now(),fetchFn=fetch}={}){
 const bars=await fetchRuleBars(rule,now,fetchFn);
 if(bars.length<50)return {status:'insufficient_data'};
 const last=bars.at(-1),previous=Number(rule.cursor)||0;
 if(last.time<=previous)return {status:'unchanged',cursor:previous};
 // Do not send historical signals when a new rule starts. Only future closes can alert.
 const events=previous>0?await extractSMCEvents(rule,bars):[];
 // Insert first. A crash before the cursor moves cannot lose events; primary key deduplicates retries.
 for(const e of events){
  await env.DB.prepare('INSERT OR IGNORE INTO alert_events (id,rule_id,candle_time,payload,status,attempts,next_try,last_error,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
   .bind(e.id,rule.id,last.time,JSON.stringify(e),'pending',0,now,null,now).run();
 }
 await env.DB.prepare('UPDATE alert_rules SET cursor=?,last_error=NULL WHERE id=? AND cursor<?')
  .bind(last.time,rule.id,last.time).run();
 return {status:previous===0?'baselined':'processed',cursor:last.time,events:events.length};
}
const validWebhook=url=>{
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.hash||!u.hostname)return false;
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.local')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('[')||host==='metadata.google.internal')return false;
  return true;
 }catch{return false}
};
async function signature(secret,message){
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return 'sha256='+hex(await crypto.subtle.sign('HMAC',key,bytes(message)));
}
export async function flushOutbox(env,{now=Date.now(),fetchFn=fetch}={}){
 if(!env.WEBHOOK_URL)return {status:'webhook_unconfigured'};
 if(!validWebhook(env.WEBHOOK_URL))throw Error('WEBHOOK_URL must be public HTTPS host');
 if(!env.WEBHOOK_SECRET||env.WEBHOOK_SECRET.length<16)throw Error('WEBHOOK_SECRET must be at least 16 chars');
 const {results:due=[]}=await env.DB.prepare("SELECT id,payload,attempts FROM alert_events WHERE status='pending' AND next_try<=? ORDER BY next_try LIMIT 6").bind(now).all();
 for(const item of due){
  const body=item.payload;
  let error=null;
  try{
   const response=await fetchFn(env.WEBHOOK_URL,{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json','user-agent':'Tradingwise-Cloud-Alerts/0.6','x-lumavun-event-id':item.id,'idempotency-key':item.id,'x-lumavun-signature-256':await signature(env.WEBHOOK_SECRET,body)}});
   if(!response.ok)throw Error('HTTP '+response.status);
  }catch(e){error=String(e.message||e).slice(0,160)}
  const attempts=item.attempts+1,status=!error?'delivered':attempts>=5?'failed':'pending';
  const nextTry=error?now+Math.min(3600000,30000*2**attempts):null;
  await env.DB.prepare('UPDATE alert_events SET attempts=?,status=?,next_try=?,last_error=? WHERE id=? AND status=\'pending\'').bind(attempts,status,nextTry,error,item.id).run();
 }
 return {attempted:due.length};
}
export async function runCron(env,{now=Date.now(),fetchFn=fetch}={}){
 if(!env.DB)throw Error('D1 binding DB missing');
 const {results:rules=[]}=await env.DB.prepare('SELECT * FROM alert_rules WHERE active=1 ORDER BY created_at LIMIT 3').all();
 const outcome=[];
 for(const rule of rules){
  try{outcome.push(await checkRule(env,rule,{now,fetchFn}))}
  catch(e){
   const message=String(e.message||e).slice(0,180);
   outcome.push({status:'error',rule:rule.id,error:message});
   await env.DB.prepare('UPDATE alert_rules SET last_error=? WHERE id=?').bind(message,rule.id).run();
  }
 }
 try{await flushOutbox(env,{now,fetchFn})}catch(e){outcome.push({delivery_error:String(e.message||e).slice(0,120)})}
 return outcome;
}
async function adminApi(request,env,path){
 if(!await authorized(request,env))return json({error:'Unauthorized or administration not configured'},401);
 if(request.method==='GET'&&path==='/api/alerts/rules'){
  const {results=[]}=await env.DB.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC').all();
  return json({items:results.map(x=>({...x,types:JSON.parse(x.types),settings:JSON.parse(x.settings),active:!!x.active}))});
 }
 if(request.method==='GET'&&path==='/api/alerts/events'){
  const {results=[]}=await env.DB.prepare('SELECT id,payload,status,attempts,last_error,created_at FROM alert_events ORDER BY created_at DESC LIMIT 100').all();
  return json({items:results.map(x=>({...x,payload:JSON.parse(x.payload)}))});
 }
 if(request.method==='POST'&&path==='/api/alerts/rules'){
  const contentType=request.headers.get('content-type')||'';if(!contentType.includes('application/json'))return json({error:'Expected JSON'},415);
  const raw=await request.text();if(raw.length>10000)return json({error:'Rule payload too large'},413);
  let data;try{data=validateRule(JSON.parse(raw))}catch(e){return json({error:e.message},e.status||400)}
  const count=await env.DB.prepare('SELECT COUNT(1) AS n FROM alert_rules').first();
  if(count.n>=MAX_RULES)return json({error:'Maximum 3 free scheduled SMC rules'},429);
  const id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare('INSERT INTO alert_rules (id,symbol,interval,types,settings,active,cursor,last_error,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
   .bind(id,data.symbol,data.interval,JSON.stringify(data.types),JSON.stringify(data.settings),data.active?1:0,0,null,now).run();
  return json({id,...data,cursor:0,status:'Created; first scheduled run baselines the latest closed candle'},201);
 }
 const match=/^\/api\/alerts\/rules\/([a-f0-9-]{36})$/.exec(path);
 if(match&&request.method==='DELETE'){
  await env.DB.prepare('DELETE FROM alert_rules WHERE id=?').bind(match[1]).run();
  return json({deleted:true});
 }
 return json({error:'Not Found'},404);
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/alerts/health'&&request.method==='GET')return json({ok:true,mode:'cloudflare-free-d1-cron',engine:'SMC JS adapter',provider:'BIQUOTE',timeframes:Object.keys(PERIODS),schedule:'*/5 * * * *',limits:{maxRules:MAX_RULES,exactPine:false},adminConfigured:!!env.ADMIN_TOKEN,webhookConfigured:!!env.WEBHOOK_URL,storageConfigured:!!env.DB});
  if(!env.DB)return json({error:'Database not configured'},503);
  if(!path.startsWith('/api/alerts/'))return json({error:'Not Found'},404);
  try{return await adminApi(request,env,path)}catch(e){return json({error:String(e.message||e)},e.status>=400&&e.status<500?e.status:500)}
 },
 async scheduled(_controller,env,ctx){ctx.waitUntil(runCron(env));}
};