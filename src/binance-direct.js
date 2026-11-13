// Browser-side access to Binance's official public market-data-only endpoints.
// Used only on static Vercel deployment where Cloudflare egress is refused by Binance.
const BASE='https://data-api.binance.vision';
const STREAM='wss://data-stream.binance.vision:443';
const periods={'1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,'1h':3600,'2h':7200,'4h':14400,'1d':86400,'1w':604800};
let catalogTask=null;
const json=async(url,signal)=>{
 const response=await fetch(url,{signal,headers:{accept:'application/json'}});
 if(!response.ok)throw Error('Binance public API HTTP '+response.status);
 return response.json();
};
export async function binanceCatalog(){
 if(!catalogTask)catalogTask=json(BASE+'/api/v3/exchangeInfo').then(data=>{
  if(!Array.isArray(data.symbols))throw Error('Binance exchangeInfo response invalid');
  return data.symbols.filter(x=>/^[A-Z0-9_.-]{2,40}$/.test(x.symbol)).map(x=>({
   id:'BINANCE:'+x.symbol,provider:'BINANCE',symbol:x.symbol,
   name:(x.baseAsset||x.symbol)+' / '+(x.quoteAsset||''),market:'Crypto',
   exchange:'Binance Spot',source:'Binance Spot',status:x.status||'UNKNOWN',
   live:x.status==='TRADING',baseAsset:x.baseAsset||'',quoteAsset:x.quoteAsset||''
  })).sort((a,b)=>a.symbol.localeCompare(b.symbol));
 }).catch(e=>{catalogTask=null;throw e});
 return catalogTask;
}
export async function binanceSearch(q='',limit=70,offset=0){
 const items=await binanceCatalog(),needle=q.trim().toLowerCase();
 const filtered=needle?items.filter(x=>(x.symbol+' '+x.name).toLowerCase().includes(needle)):items;
 return {items:filtered.slice(offset,offset+limit),total:filtered.length,offset,limit,errors:{},counts:{BINANCE:items.length}};
}
export async function binanceCandles(id,interval='1h',limit=650){
 const symbol=id.split(':')[1];
 if(!/^[A-Z0-9_.-]{2,40}$/.test(symbol)||!periods[interval])throw Error('Invalid Binance symbol or timeframe');
 const u=BASE+'/api/v3/klines?'+new URLSearchParams({symbol,interval,limit:String(Math.min(1000,limit))});
 const rows=await json(u);
 if(!Array.isArray(rows)||!rows.length)throw Error('Binance returned empty historical candles');
 const candles=rows.map(r=>{
  const time=Math.floor(Number(r[0])/1000);
  return {time,open:Number(r[1]),high:Number(r[2]),low:Number(r[3]),close:Number(r[4]),volume:Number(r[5]),isOpen:(time+periods[interval])*1000>Date.now()};
 }).filter(b=>b.time>0&&[b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0));
 if(!candles.length)throw Error('Binance returned no valid candles');
 return {candles,source:'rest',note:'BINANCE direct REST (browser)',aggregated:false,lastUpdate:candles.at(-1).time};
}
export async function binanceTickers(ids){
 const symbols=ids.filter(id=>id.startsWith('BINANCE:')).map(id=>id.split(':')[1]);
 if(!symbols.length)return [];
 const raw=await json(BASE+'/api/v3/ticker/24hr?'+new URLSearchParams({symbols:JSON.stringify(symbols)}));
 return (Array.isArray(raw)?raw:[raw]).filter(x=>Number(x.lastPrice)>0).map(x=>({
  symbol:'BINANCE:'+x.symbol,last:Number(x.lastPrice),change:Number(x.priceChangePercent),
  marketState:'open',stale:false,source:'BINANCE'
 }));
}
export function binanceSocket(id,interval,onCandle,onStatus){
 const symbol=id.split(':')[1],url=STREAM+'/ws/'+symbol.toLowerCase()+'@kline_'+interval;
 let stopped=false,socket,timer,delay=1200;
 function connect(){
  if(stopped)return;
  try{
   socket=new WebSocket(url);onStatus?.('connecting');
   socket.onopen=()=>{delay=1200;onStatus?.('connected')};
   socket.onmessage=e=>{try{
    const packet=JSON.parse(e.data),k=packet.k;if(packet.e!=='kline'||!k||packet.s!==symbol||k.i!==interval)return;
    const b={time:Math.floor(Number(k.t)/1000),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v),isOpen:!k.x};
    if([b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0))onCandle?.(b);
   }catch{}};
   socket.onerror=()=>onStatus?.('reconnecting','Binance direct WebSocket error');
   socket.onclose=()=>{if(stopped)return;onStatus?.('reconnecting');timer=setTimeout(connect,delay);delay=Math.min(20000,delay*2)};
  }catch(e){onStatus?.('error',e.message);timer=setTimeout(connect,delay)}
 }
 connect();
 return ()=>{stopped=true;clearTimeout(timer);try{socket?.close()}catch{}};
}
