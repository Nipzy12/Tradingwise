// Public read-only market data adapters. No synthetic candles or hidden proxy fallbacks.
export const INTERVALS = Object.freeze(['1m','3m','5m','15m','30m','1h','2h','4h','1d','1w']);
export const BIQUOTE_NATIVE = new Set(['1m','5m','15m','30m','1h','4h','1d']);
export const BINANCE_NATIVE = new Set(['1m','3m','5m','15m','30m','1h','2h','4h','1d','1w']);
export const PROVIDERS = Object.freeze(['BINANCE','BIQUOTE']);
const VALID_SYMBOL = /^[A-Z0-9_.-]{2,40}$/;
export const DEFAULT_BASES = Object.freeze({
 BINANCE_REST:'https://data-api.binance.vision',
 BINANCE_WS:'wss://data-stream.binance.vision:443',
 BIQUOTE_REST:'https://biquote.io',
 BIQUOTE_HUB:'https://biquote.io/hubs/tick'
});
export function parseMarketId(id){
 if(typeof id!=='string')throw Object.assign(Error('ID simbol harus string'),{status:400});
 const m=/^(BINANCE|BIQUOTE):([A-Z0-9_.-]{2,40})$/.exec(id.toUpperCase());
 if(!m)throw Object.assign(Error('Format simbol: BINANCE:BTCUSDT atau BIQUOTE:XAUUSD'),{status:400});
 return {id:m[0],provider:m[1],symbol:m[2]};
}
export function marketId(provider,symbol){const p=String(provider||'').toUpperCase(),s=String(symbol||'').toUpperCase();if(!PROVIDERS.includes(p)||!VALID_SYMBOL.test(s))throw Error('Invalid symbol');return `${p}:${s}`}
export function normalizeSymbols(provider,payload){
 let rows=provider==='BINANCE'?payload?.symbols:(Array.isArray(payload)?payload:payload?.items||payload?.symbols||payload?.data);
 if(!Array.isArray(rows))throw Error(`${provider} catalog response invalid`);
 const dedup=new Map();
 for(const item of rows){
  const symbol=String(provider==='BINANCE'?item.symbol:item.name||item.symbol||'').toUpperCase();
  if(!VALID_SYMBOL.test(symbol))continue;
  const p=provider==='BINANCE';
  dedup.set(marketId(provider,symbol),{
   id:marketId(provider,symbol),provider,symbol,
   name:p?`${item.baseAsset||symbol} / ${item.quoteAsset||''}`.trim():String(item.description||symbol),
   market:p?'Crypto':String(item.type||'Unknown'),
   exchange:p?'Binance Spot':String(item.exchange||'Biquote'),
   source:p?'Binance Spot':String(item.source||'Biquote'),
   status:p?String(item.status||'UNKNOWN'):item.isActive===false?'INACTIVE':'LISTED',
   live:p?item.status==='TRADING':Boolean(item.isLive||item.live||false),
   baseAsset:p?String(item.baseAsset||''):'',quoteAsset:p?String(item.quoteAsset||''):''
  });
 }
 return [...dedup.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
export function validateInterval(provider,interval){
 if(!INTERVALS.includes(interval))throw Object.assign(Error('Timeframe tidak dikenal'),{status:400});
 if(provider==='BIQUOTE'&&!BIQUOTE_NATIVE.has(interval)&&interval!=='1w')throw Object.assign(Error(`Timeframe ${interval} tidak tersedia di Biquote`),{status:400});
 if(provider==='BINANCE'&&!BINANCE_NATIVE.has(interval))throw Object.assign(Error('Timeframe Binance tidak tersedia'),{status:400});
 return provider==='BIQUOTE'&&interval==='1w'?'1d':interval;
}
function bar(time,open,high,low,close,volume=0,isOpen=false){
 const b={time:Number(time),open:Number(open),high:Number(high),low:Number(low),close:Number(close),volume:Number(volume)||0,isOpen:!!isOpen};
 if(!Number.isInteger(b.time)||b.time<=0||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close))return null;
 return b;
}
export function normalizeBinanceKlines(rows){
 if(!Array.isArray(rows))throw Error('Binance klines format invalid');
 return rows.map(r=>Array.isArray(r)?bar(Math.floor(Number(r[0])/1000),r[1],r[2],r[3],r[4],r[5]):null).filter(Boolean).sort((a,b)=>a.time-b.time);
}
export function normalizeBiquoteOhlc(payload){
 const rows=payload?.bars;if(!Array.isArray(rows))throw Error('Biquote OHLC response invalid');
 const unique=new Map();
 for(const r of rows){const time=Date.parse(r.openTime);if(!Number.isFinite(time))continue;const b=bar(Math.floor(time/1000),r.open,r.high,r.low,r.close,(Number(r.volume)>0?Number(r.volume):r.tickVolume??0),r.isOpen);if(b)unique.set(b.time,b)}
 return [...unique.values()].sort((a,b)=>a.time-b.time);
}
export function weeklyMonday(timestamp){const d=new Date(timestamp*1000);const day=d.getUTCDay();return Math.floor(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(day+6)%7)/1000)}
export function aggregateWeekly(daily){
 const weeks=new Map();
 for(const d of [...daily].sort((a,b)=>a.time-b.time)){
  const t=weeklyMonday(d.time),w=weeks.get(t);
  if(w){w.high=Math.max(w.high,d.high);w.low=Math.min(w.low,d.low);w.close=d.close;w.volume+=d.volume;w.isOpen=d.isOpen}
  else weeks.set(t,{...d,time:t});
 }
 return [...weeks.values()];
}
export function tickFromBiquote(payload){
 if(!payload||!VALID_SYMBOL.test(String(payload.symbol||'').toUpperCase()))return null;
 const price=Number(payload.mid)>0?Number(payload.mid):(Number(payload.bid)>0&&Number(payload.ask)>0?(Number(payload.bid)+Number(payload.ask))/2:NaN);
 const parsed=Date.parse(payload.timestamp||payload.lastQuoteAt||'');
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(parsed))return null;
 const marketState=String(payload.marketState||'unknown').toLowerCase();
 return {type:'tick',id:marketId('BIQUOTE',payload.symbol),provider:'BIQUOTE',symbol:payload.symbol,price,bid:Number(payload.bid)||null,ask:Number(payload.ask)||null,time:Math.floor(parsed/1000),marketState,stale:payload.stale===true,quoteAgeSeconds:Number(payload.quoteAgeSeconds??0),change:Number.isFinite(Number(payload.dayDiffPercent))?Number(payload.dayDiffPercent):null};
}
export function candleFromBinance(payload){
 const packet=payload?.data||payload;
 const k=packet?.k;
 if(packet?.e!=='kline'||!k)return null;
 const result=bar(Math.floor(Number(k.t)/1000),k.o,k.h,k.l,k.c,k.v,!k.x);
 if(!result)return null;
 return {type:'candle',id:marketId('BINANCE',packet.s),provider:'BINANCE',symbol:packet.s,interval:k.i,bar:result};
}
export function bucketTime(timestamp,interval){
 if(interval==='1w')return weeklyMonday(timestamp);
 const seconds={'1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,'1h':3600,'2h':7200,'4h':14400,'1d':86400}[interval];
 if(!seconds)throw Error('Unsupported interval');return Math.floor(timestamp/seconds)*seconds;
}
export function applyTickToCandle(last,tick,interval){
 if(tick.stale||tick.marketState==='closed'||tick.marketState==='halted')return null;
 const t=bucketTime(tick.time,interval),price=tick.price;
 if(!Number.isFinite(price)||price<=0)return null;
 if(last&&t<last.time)return null;
 if(last&&t===last.time)return {...last,high:Math.max(last.high,price),low:Math.min(last.low,price),close:price,isOpen:true};
 return {time:t,open:price,high:price,low:price,close:price,volume:0,isOpen:true};
}
export async function getJson(url,fetchFn=fetch,timeout=11000){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{const res=await fetchFn(url,{signal:ctl.signal,headers:{accept:'application/json'}});if(!res.ok){const e=Error(`Provider HTTP ${res.status}`);e.status=res.status===429?429:502;throw e}return await res.json()}
 finally{clearTimeout(timer)}
}
export class MarketCatalog{
 constructor({fetchFn=fetch,bases=DEFAULT_BASES,ttlMs=300000}={}){this.fetchFn=fetchFn;this.bases=bases;this.ttlMs=ttlMs;this.cache=new Map();this.pending=new Map();this.errors=new Map()}
 async load(provider){
  const cache=this.cache.get(provider);if(cache&&Date.now()-cache.at<this.ttlMs)return cache.items;
  if(this.pending.has(provider))return this.pending.get(provider);
  const promise=(async()=>{
   try{
    const url=provider==='BINANCE'?`${this.bases.BINANCE_REST}/api/v3/exchangeInfo`:`${this.bases.BIQUOTE_REST}/api/symbols`;
    const body=await getJson(url,this.fetchFn);
    const items=normalizeSymbols(provider,body);this.cache.set(provider,{at:Date.now(),items});this.errors.delete(provider);return items;
   }catch(e){this.errors.set(provider,e.message);if(cache)return cache.items;throw e}
   finally{this.pending.delete(provider)}
  })();this.pending.set(provider,promise);return promise;
 }
 async search({provider='ALL',q='',offset=0,limit=70}={}){
  const which=provider==='ALL'?PROVIDERS:[provider];if(!which.every(p=>PROVIDERS.includes(p)))throw Object.assign(Error('Provider tidak dikenal'),{status:400});
  const results=await Promise.allSettled(which.map(p=>this.load(p)));
  let items=[];const errors={};
  results.forEach((r,i)=>{if(r.status==='fulfilled')items.push(...r.value);else errors[which[i]]=r.reason.message});
  const needle=String(q).trim().toLowerCase();if(needle)items=items.filter(m=>`${m.symbol} ${m.name} ${m.market} ${m.exchange}`.toLowerCase().includes(needle));
  items.sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.provider.localeCompare(b.provider));
  return {items:items.slice(offset,offset+limit),total:items.length,offset,limit,errors,counts:Object.fromEntries(PROVIDERS.map(p=>[p,(this.cache.get(p)?.items||[]).length]))};
 }
 async lookup(id){const {provider}=parseMarketId(id),items=await this.load(provider);const item=items.find(x=>x.id===parseMarketId(id).id);if(!item)throw Object.assign(Error('Simbol tidak ditemukan di katalog provider'),{status:404});return item}
}
export async function readCandles({id,interval='1h',limit=600,catalog,fetchFn=fetch,bases=DEFAULT_BASES}){
 const {provider,symbol}=parseMarketId(id);
 await catalog.lookup(id); // Reject arbitrary/unlisted symbols and unavailable providers.
 const native=validateInterval(provider,interval),fetchLimit=Math.min(1000,Math.max(30,Math.trunc(limit)*(interval==='1w'&&provider==='BIQUOTE'?7:1)));
 const url=provider==='BINANCE'?`${bases.BINANCE_REST}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${native}&limit=${fetchLimit}`:
 `${bases.BIQUOTE_REST}/api/${encodeURIComponent(symbol)}/ohlc?interval=${native}&limit=${fetchLimit}`;
 const body=await getJson(url,fetchFn);
 const normalized=provider==='BINANCE'?normalizeBinanceKlines(body):normalizeBiquoteOhlc(body);
 const candles=(provider==='BIQUOTE'&&interval==='1w'?aggregateWeekly(normalized):normalized).slice(-limit);
 if(!candles.length)throw Object.assign(Error('Provider mengembalikan 0 candle. Tidak diganti dengan data simulasi.'),{status:502});
 return {id,provider,symbol,interval,candles,source:'market',status:'REST',aggregated:provider==='BIQUOTE'&&interval==='1w',lastUpdate:candles.at(-1).time};
}
export async function readTickers({ids=[],catalog,fetchFn=fetch,bases=DEFAULT_BASES}){
 const list=[...new Set(ids)].slice(0,60).map(parseMarketId);
 const binance=list.filter(x=>x.provider==='BINANCE'),biquote=list.filter(x=>x.provider==='BIQUOTE');const result=[];
 const jobs=[];
 if(binance.length)jobs.push((async()=>{
  const res=await getJson(`${bases.BINANCE_REST}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(binance.map(x=>x.symbol)))}`,fetchFn,10000);
  const rows=Array.isArray(res)?res:[res];for(const x of rows){const id=marketId('BINANCE',x.symbol);if(!binance.some(i=>i.id===id))continue;const price=Number(x.lastPrice);if(price>0)result.push({id,price,change:Number(x.priceChangePercent),marketState:'open',stale:false,provider:'BINANCE'})}
 })());
 if(biquote.length)jobs.push((async()=>{
  const params=new URLSearchParams();for(const x of biquote)params.append('symbols',x.symbol);
  const res=await getJson(`${bases.BIQUOTE_REST}/api/latest?${params}`,fetchFn,10000);
  const rows=Array.isArray(res)?res:Array.isArray(res.items)?res.items:Array.isArray(res.ticks)?res.ticks:Object.values(res).filter(x=>x&&typeof x==='object'&&x.symbol);
  for(const x of rows){const tick=tickFromBiquote(x);if(tick&&biquote.some(i=>i.id===tick.id))result.push({id:tick.id,price:tick.price,change:tick.marketState==='closed'?null:tick.change,marketState:tick.marketState,stale:tick.stale,provider:'BIQUOTE',quoteAgeSeconds:tick.quoteAgeSeconds})}
 })());
 const outcomes=await Promise.allSettled(jobs);const errors=outcomes.filter(r=>r.status==='rejected').map(r=>r.reason.message);
 return {items:result,errors};
}
