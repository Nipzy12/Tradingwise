import {ctraderSymbols,ctraderCandles,pollCtrader} from './ctrader.js';
import {binanceSearch,binanceCandles,binanceTickers,binanceSocket} from './binance-direct.js';
// Browser market-data adapter. All prices and symbol metadata come from the Node gateway.
export const MARKETS=[];
export const PERIODS={'1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,'1h':3600,'2h':7200,'4h':14400,'1d':86400,'1w':604800};
export const defaultWatchlist=['BINANCE:BTCUSDT','BINANCE:ETHUSDT','BINANCE:SOLUSDT','BINANCE:BNBUSDT','BIQUOTE:XAUUSD','BIQUOTE:EURUSD','BIQUOTE:GBPUSD'];
const metaCache=new Map();
// Public edge API for Vercel static frontend; Node self-host uses same-origin endpoints.
export const EDGE_ORIGIN = (typeof location!=='undefined' && /\.vercel\.app$/i.test(location.hostname)) ? 'https://tradingwise-market.nexoraz.workers.dev' : '';
export function legacyId(value){if(typeof value!=='string')return '';if(value.includes(':'))return value.toUpperCase();const s=value.toUpperCase();return /^(XAU|XAG|EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)/.test(s)?'BIQUOTE:'+s:'BINANCE:'+s}
export function marketInfo(id){return metaCache.get(id)||{id,provider:id.split(':')[0]||'UNKNOWN',symbol:id.split(':')[1]||id,name:id.split(':')[1]||id,market:'Unknown',exchange:id.split(':')[0]||'',source:'Unverified',icon:(id.split(':')[1]||'?').slice(0,1),quoteAsset:id.endsWith('USDT')?'USDT':/^(?:USD|EUR|GBP|AUD|NZD|CAD|CHF|JPY)$/.test(id.slice(-3))?id.slice(-3):'USD'};}
export function storeMarketInfo(items){for(const x of items){if(!x?.id)continue;const symbol=x.symbol||x.id.split(':')[1],icon=symbol.startsWith('BTC')?'₿':symbol.startsWith('ETH')?'Ξ':symbol.startsWith('XAU')?'Au':symbol.startsWith('EUR')?'€':symbol.slice(0,1);metaCache.set(x.id,{...x,icon})}}
export function displayNum(v,id){if(!Number.isFinite(Number(v)))return '–';const n=Number(v),symbol=marketInfo(id).symbol;const precision=/^(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY)/.test(symbol)&&n<10?5:n<1?6:n<10?4:n<100?3:2;return n.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision})}
const readJson=async (url,{signal}={})=>{const response=await fetch(url,{signal,cache:'no-store',headers:{accept:'application/json'}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw Error(payload.error||`Backend HTTP ${response.status}`);return payload};
export async function searchSymbols({provider='ALL',q='',limit=70,offset=0,signal}={}){
 if(provider==='CTRADER'){const data=await ctraderSymbols({q,limit,offset});storeMarketInfo(data.items||[]);return data}
 if(EDGE_ORIGIN&&provider==='BINANCE'){
  try{const data=await binanceSearch(q,limit,offset);storeMarketInfo(data.items);return data}
  catch(e){console.warn('Binance browser catalog unavailable:',e.message)}
 }
 const params=new URLSearchParams({provider,q,limit:String(limit),offset:String(offset)});
 const data=await readJson(EDGE_ORIGIN+'/api/market/symbols?'+params,{signal});
 if(EDGE_ORIGIN&&provider==='ALL'&&q.trim().length>=2){
  try{
   const direct=await binanceSearch(q,limit,offset);
   data.items=[...new Map([...data.items,...direct.items].map(x=>[x.id,x])).values()]
     .sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.provider.localeCompare(b.provider));
   data.total+=direct.total;data.errors={...data.errors};delete data.errors.BINANCE;
   data.counts.BINANCE=direct.counts.BINANCE;
  }catch(e){data.errors={...data.errors,BINANCE:'Binance direct unavailable: '+e.message}}
 }
 storeMarketInfo(data.items||[]);return data
}
export async function getCandles(id,interval='1h'){
 if(id.startsWith('CTRADER:'))return ctraderCandles(id,interval,400);
 const params=new URLSearchParams({symbol:id,interval,limit:'650'});
 if(EDGE_ORIGIN&&id.startsWith('BINANCE:')){
  try{return await binanceCandles(id,interval)}catch(e){console.warn('Binance direct REST failed:',e.message)}
 }
 const result=await readJson(EDGE_ORIGIN+'/api/market/candles?'+params);
 if(!Array.isArray(result.candles)||!result.candles.length)throw Error('Provider returned no candles');
 return {candles:result.candles,source:'rest',note:`${result.provider} REST${result.aggregated?' · 1W aggregated from 1D':''}`,aggregated:result.aggregated,lastUpdate:result.lastUpdate};
}
export async function fetchTickers(ids){
 ids=ids.filter(x=>!x.startsWith('CTRADER:'));
 if(!ids.length)return[];
 const params=new URLSearchParams({symbols:[...new Set(ids)].slice(0,60).join(',')});
 const data=await readJson(EDGE_ORIGIN+'/api/market/tickers?'+params);
 const items=(data.items||[]).map(x=>({symbol:x.id,last:x.price,change:x.change,marketState:x.marketState,stale:x.stale,source:x.provider}));
 if(EDGE_ORIGIN){
  try{
   const extra=await binanceTickers(ids);
   for(const x of extra)if(!items.some(i=>i.symbol===x.symbol))items.push(x);
  }catch(e){console.warn('Binance browser tickers unavailable:',e.message)}
 }
 return items;
}
function weekStart(timestamp){const d=new Date(timestamp*1000);return Math.floor(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7)/1000)}
export function tickToCandle(tick,last,tf){if(!tick||tick.stale||['closed','halted'].includes(tick.marketState))return null;const bucket=tf==='1w'?weekStart(tick.time):Math.floor(tick.time/PERIODS[tf])*PERIODS[tf];if(last&&bucket<last.time)return null;const price=Number(tick.price);if(!(price>0))return null;if(last&&bucket===last.time)return {...last,high:Math.max(last.high,price),low:Math.min(last.low,price),close:price,isOpen:true};return {time:bucket,open:price,high:price,low:price,close:price,volume:0,isOpen:true}}
export function subscribeMarket(id,tf,onCandle,onStatus,onTick){
 if(id.startsWith('CTRADER:'))return pollCtrader(id,tf,onCandle,onStatus);
 if(EDGE_ORIGIN&&id.startsWith('BINANCE:'))return binanceSocket(id,tf,onCandle,onStatus);
 let stopped=false,ws=null,timer=null,retry=1200;const wsUrl=()=>new URL(EDGE_ORIGIN+'/ws/market',document.baseURI).href.replace(/^http/,'ws');
 const connect=()=>{
  if(stopped)return;
  try{
   ws=new WebSocket(wsUrl());onStatus?.('connecting');
   ws.onopen=()=>{retry=1200;ws.send(JSON.stringify({action:'subscribe',symbol:id,interval:tf}))};
   ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(msg.type==='status'){onStatus?.(msg.status,msg.reason);return}
    if(msg.type==='error'){onStatus?.('error',msg.message);return}
    if(msg.type==='tick'&&msg.id===id){onTick?.(msg);return}
    if(msg.type==='candle'&&msg.id===id&&msg.interval===tf){onCandle?.(msg.bar);return}
   };
   ws.onerror=()=>onStatus?.('reconnecting');
   ws.onclose=()=>{if(stopped)return;onStatus?.('reconnecting');timer=setTimeout(connect,retry);retry=Math.min(retry*2,20000)};
  }catch(e){onStatus?.('error',e.message);timer=setTimeout(connect,retry);retry=Math.min(retry*2,20000)}
 };
 connect();return ()=>{stopped=true;clearTimeout(timer);try{ws?.close()}catch{}};
}
