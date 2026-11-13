import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {AlertStore} from './alert-store.mjs';
import {readCandles,parseMarketId,validateInterval,applyTickToCandle,bucketTime} from './providers.mjs';
import {PERIODS} from '../src/market.js';
import {SMC_DEFAULTS,computeSMC,smcSettings} from '../src/smc.js';

export const SMC_ALERT_TYPES=Object.freeze(['SMC_ZONE_INVALIDATED','SMC_NEW_BUY_PLAN','SMC_NEW_SELL_PLAN','SMC_ENTRY_BUY','SMC_ENTRY_SELL','SMC_TAKE_PROFIT','SMC_STOP_LOSS']);
const MAX_RULES=100,MAX_EVENTS=500,MAX_OUTBOX=600;
const err=(message,status=400)=>Object.assign(Error(message),{status});
const textEqual=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function authenticate(req,token){
 if(!token)return false;const value=req.headers.authorization||'';return value.startsWith('Bearer ')&&textEqual(value.slice(7),token);
}
export function validateWebhookURL(raw,{allowLocal=false}={}){
 if(!raw)return null;let url;try{url=new URL(raw)}catch{throw err('Invalid ALERT_WEBHOOK_URL')}
 if(url.protocol!=='https:'&&!(allowLocal&&url.protocol==='http:'))throw err('Webhook URL must use HTTPS');
 if(url.username||url.password||url.hash)throw err('Webhook URL cannot contain credentials or fragment');
 if(!url.hostname||url.hostname==='localhost'&&!allowLocal||url.hostname.endsWith('.local'))throw err('Local webhook targets are forbidden');
 return url.toString();
}
function privateIP(ip){
 if(ip.includes(':'))return true; // Disallow IPv6 destination; restrict to public IPv4 for conservative validation.
 const a=ip.split('.').map(Number);if(a.length!==4||a.some(v=>!Number.isInteger(v)||v<0||v>255))return true;
 return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0||a[0]===198&&a[1]>=18&&a[1]<=19;
}
export function eventFromSMC(rule,candles,event,sequence=0){
 const {reason,side,model}=event;let type;
 if(reason==='zoneRemoved')type='SMC_ZONE_INVALIDATED';
 if(reason==='plan')type=side===1?'SMC_NEW_BUY_PLAN':'SMC_NEW_SELL_PLAN';
 if(reason==='entry')type=side===1?'SMC_ENTRY_BUY':'SMC_ENTRY_SELL';
 if(reason==='tp')type='SMC_TAKE_PROFIT';
 if(reason==='sl')type='SMC_STOP_LOSS';
 if(!type||!rule.types.includes(type))return null;
 const bar=candles[event.bar];if(!bar)return null;
 const trade=(reason==='entry'?null:reason==='tp'||reason==='sl'?rule._trades?.find(t=>t.end===event.bar&&t.side===side&&t.model===model):null)||null;
 const plan=reason==='plan'?rule._pending?.find(p=>p.born===event.bar&&p.model===model&&p.side===side):null;
 const active=plan||trade||rule._trades?.find(t=>t.born===event.bar&&t.side===side&&t.model===model)||null;
 const key=[rule.id,bar.time,reason,side??'',model??'',event.label??'',sequence].join('|');
 return {id:createHash('sha256').update(key).digest('hex').slice(0,32),event:type,ruleId:rule.id,indicator:'SMC Entry Models PRO v5 (JavaScript adaptation)',provider:parseMarketId(rule.symbol).provider,symbol:parseMarketId(rule.symbol).symbol,marketId:rule.symbol,timeframe:rule.interval,candleOpenTime:new Date(bar.time*1000).toISOString(),timestamp:new Date((bar.time+(PERIODS[rule.interval]||3600))*1000).toISOString(),confirmed:true,model:model||null,side:side===1?'BUY':side===-1?'SELL':null,entry:active?.entry??event.entry??null,sl:active?.sl??event.sl??null,tp:active?.tp??null,price:event.price??bar.close,label:event.label??null,candle:{open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume||0}};
}
export function smcEvents(rule,candles){
 const out=computeSMC(candles,rule.settings,rule.interval);
 if(out.warning)return[];
 const last=candles.length-1,matched=out.events.filter(e=>e.bar===last);
 // This annotation is used only to enrich outgoing webhook payloads.
 const enriched={...rule,_trades:out.trades,_pending:out.pending};
 return matched.map((e,i)=>eventFromSMC(enriched,candles,e,i)).filter(Boolean);
}
export class AlertEngine{
 constructor({catalog,binance,biquote,store=new AlertStore(),fetchFn=fetch,deliveryFetch=fetch,bases,webhookUrl='',secret='',adminToken='',allowLocalWebhook=false,clock=()=>Date.now(),logger=console}={}){
  this.catalog=catalog;this.binance=binance;this.biquote=biquote;this.store=store;this.fetchFn=fetchFn;this.deliveryFetch=deliveryFetch;this.bases=bases;
  this.url=validateWebhookURL(webhookUrl,{allowLocal:allowLocalWebhook});this.secret=secret;this.adminToken=adminToken;this.allowLocalWebhook=allowLocalWebhook;this.clock=clock;this.logger=logger;
  this.active=new Map();this.started=false;this.stopped=false;this.deliveryTimer=null;this.sending=false;
 }
 async start(){if(this.started)return;await this.store.load();this.started=true;this.stopped=false;this.deliveryTimer=setInterval(()=>{void this.flush().catch(e=>this.logger.error('Alert delivery',e.message))},5000);this.deliveryTimer.unref?.();for(const rule of this.store.snapshot().rules.filter(r=>r.active))void this.attach(rule).catch(e=>this.logger.error('Alert subscription',rule.id,e.message));}
 async close(){this.stopped=true;clearInterval(this.deliveryTimer);for(const run of this.active.values())run.unsubscribe?.();this.active.clear();await this.store.pending;}
 status(){const data=this.store.snapshot();return {enabled:Boolean(this.adminToken),webhookConfigured:Boolean(this.url),signed:Boolean(this.secret),rules:data.rules.length,subscriptions:this.active.size,pending:data.outbox.filter(x=>x.status==='pending').length};}
 listRules(){return this.store.snapshot().rules}
 listEvents(){return this.store.snapshot().events.slice(-100).reverse()}
 async createRule({symbol,interval='5m',types=['SMC_ENTRY_BUY','SMC_ENTRY_SELL'],settings={},active=true}={}){
  if(this.store.data.rules.length>=MAX_RULES)throw err('Rule limit reached',429);
  const parsed=parseMarketId(symbol);validateInterval(parsed.provider,interval);
  if(!Array.isArray(types)||!types.length||types.length>7||types.some(t=>!SMC_ALERT_TYPES.includes(t)))throw err('Invalid alert event types');
  if(typeof active!=='boolean')throw err('active must be boolean');
  if(!settings||typeof settings!=='object'||Array.isArray(settings))throw err('Invalid SMC settings');
  const clean=smcSettings(settings),selected=[...new Set(types)];
  if(clean.htfMode!=='Off'&&(PERIODS[interval]||0)>=(PERIODS[clean.htfTF]||Infinity))throw err('SMC HTF must be higher than alert timeframe');
  await this.catalog.lookup(parsed.id);
  const rule={id:randomUUID(),symbol:parsed.id,interval,types:selected,settings:clean,active,createdAt:new Date(this.clock()).toISOString(),cursor:0};
  await this.store.mutate(data=>{data.rules.push(rule)});
  if(active)void this.attach(rule).catch(e=>this.logger.error('Alert subscription',rule.id,e.message));
  return rule;
 }
 async deleteRule(id){const old=this.store.data.rules.find(r=>r.id===id);if(!old)throw err('Alert rule not found',404);this.detach(id);await this.store.mutate(data=>{data.rules=data.rules.filter(r=>r.id!==id)});return true;}
 detach(id){const state=this.active.get(id);if(state){state.disabled=true;state.unsubscribe?.();this.active.delete(id)}}
 async attach(rule){
  if(this.stopped||this.active.has(rule.id))return;
  const state={ruleId:rule.id,bars:[],current:null,unsubscribe:null,disabled:false,queue:Promise.resolve(),seeded:false};this.active.set(rule.id,state);
  try{
   const history=await readCandles({id:rule.symbol,interval:rule.interval,limit:500,catalog:this.catalog,fetchFn:this.fetchFn,bases:this.bases});
   if(state.disabled||this.stopped)return;
   state.bars=history.candles.slice(-500);
   // REST's trailing bar can be still open. Baseline at the latest bar prevents historical alert floods.
   const baseline=state.bars.at(-1)?.time||0;
   if(rule.cursor<baseline){rule.cursor=baseline;await this.store.mutate(data=>{const found=data.rules.find(r=>r.id===rule.id);if(found)found.cursor=Math.max(found.cursor||0,baseline)})}
   state.seeded=true;
   const receive=message=>{
    if(state.disabled||!state.seeded||this.stopped)return;
    state.queue=state.queue.then(()=>this.onMarket(state,rule,message)).catch(e=>this.logger.error('Alert candle',rule.id,e.message));
   };
   state.unsubscribe=rule.symbol.startsWith('BINANCE:')?this.binance.subscribe(rule.symbol,rule.interval,receive):this.biquote.subscribe(rule.symbol,receive);
  }catch(e){this.active.delete(rule.id);throw e}
 }
 async onMarket(state,rule,message){
  if(state.disabled||message.type==='status')return;
  if(message.type==='candle'){
   const bar=message.bar;
   if(message.id!==rule.symbol||message.interval!==rule.interval||!bar)return;
   if(bar.isOpen){state.current=bar;return}
   await this.processClosed(state,rule,bar);
  }
  if(message.type==='tick'&&message.id===rule.symbol){
   if(message.stale||['closed','halted'].includes(message.marketState))return;
   const last=state.current||state.bars.at(-1),next=applyTickToCandle(last,message,rule.interval);
   if(!next)return;
   if(last&&next.time>last.time){
    if(state.current)await this.processClosed(state,rule,{...state.current,isOpen:false});
    state.current=next;
   }else if(!last||next.time===last.time)state.current=next;
  }
 }
 async processClosed(state,rule,bar){
  if(state.disabled||this.stopped||!bar||!Number.isFinite(bar.time))return;
  if(bar.time<=(rule.cursor||0))return;
  const last=state.bars.at(-1);
  if(last&&bar.time<last.time)return;
  if(last&&bar.time===last.time)state.bars[state.bars.length-1]=bar;
  else state.bars.push(bar);
  if(state.bars.length>500)state.bars=state.bars.slice(-500);
  const events=smcEvents(rule,state.bars);rule.cursor=bar.time;
  await this.store.mutate(data=>{
   const entry=data.rules.find(r=>r.id===rule.id);if(!entry)return;
   entry.cursor=Math.max(entry.cursor||0,bar.time);
   for(const event of events){if(data.events.some(e=>e.id===event.id))continue;
    data.events.push(event);if(this.url)data.outbox.push({eventId:event.id,payload:event,status:'pending',attempts:0,nextTry:this.clock()});
   }
   data.events=data.events.slice(-MAX_EVENTS);
   data.outbox=data.outbox.slice(-MAX_OUTBOX);
  });
  if(events.length&&this.url)void this.flush().catch(e=>this.logger.error('Webhook',e.message));
 }
 async send(payload){
  if(!this.url)throw err('ALERT_WEBHOOK_URL is not set',503);
  if(!this.allowLocalWebhook){const h=new URL(this.url).hostname;const results=await lookup(h,{all:true,verbatim:true});if(!results.length||results.some(r=>privateIP(r.address)))throw Error('Webhook DNS resolved to restricted IP');}
  const body=JSON.stringify(payload);const headers={'Content-Type':'application/json','User-Agent':'LUMAVUN-Alerts/1.0','X-Lumavun-Event-Id':payload.id,'Idempotency-Key':payload.id};
  if(this.secret)headers['X-Lumavun-Signature-256']='sha256='+createHmac('sha256',this.secret).update(body).digest('hex');
  const response=await this.deliveryFetch(this.url,{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(`Webhook HTTP ${response.status}`);
  return true;
 }
 async flush(){
  if(!this.url||this.stopped||this.sending)return;
  this.sending=true;
  try{
   let due=this.store.data.outbox.filter(x=>x.status==='pending'&&x.nextTry<=this.clock()).slice(0,15);
   for(const item of due){
    let error=null;try{await this.send(item.payload)}catch(e){error=String(e.message||e).slice(0,160)}
    await this.store.mutate(data=>{const q=data.outbox.find(x=>x.eventId===item.eventId);if(!q||q.status!=='pending')return;
     q.attempts++;q.lastError=error;q.status=!error?'delivered':q.attempts>=5?'failed':'pending';q.nextTry=error?this.clock()+Math.min(3600000,2000*2**q.attempts):null;q.lastAttempt=this.clock();
    });
   }
  }finally{this.sending=false}
 }
 async sendTest(){const payload={id:randomUUID(),event:'WEBHOOK_TEST',indicator:'LUMAVUN',timestamp:new Date(this.clock()).toISOString(),test:true};await this.send(payload);return {id:payload.id,delivered:true};}
}
