// cTrader broker-specific market data, same-origin secure HTTP session via Vercel rewrite.
// No OAuth token or client secret is accessible in JavaScript.
const PATH='/api/ctrader';
export const CTRADER_SUPPORTED=Object.freeze(new Set(['1m','3m','5m','15m','30m','1h','4h','1d','1w']));
async function get(path){
 const r=await fetch(PATH+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(body.error||`cTrader API HTTP ${r.status}`),{status:r.status});
 return body;
}
export function startCtraderLogin(){location.assign(PATH+'/oauth/start')}
export async function ctraderSession(){return get('/session')}
export async function ctraderAccounts(){const data=await get('/accounts');return data.accounts||[]}
export async function ctraderAccountId(){
 const list=await ctraderAccounts();if(!list.length)throw Error('No cTrader accounts authorized');
 const saved=localStorage.getItem('tw_ctrader_account');const selected=list.find(x=>x.accountId===saved)||list[0];
 return selected.accountId;
}
export function selectCtraderAccount(id){if(!/^\d{1,20}$/.test(String(id)))throw Error('Invalid cTrader account');localStorage.setItem('tw_ctrader_account',String(id))}
export async function ctraderSymbols({q='',offset=0,limit=70}={}){
 const account=await ctraderAccountId();const params=new URLSearchParams({q,account,offset:String(offset),limit:String(limit)});
 return get('/symbols?'+params);
}
export async function ctraderCandles(symbol,tf,limit=300){
 if(!/^CTRADER:\d{1,20}:\d{1,20}$/.test(symbol)||!CTRADER_SUPPORTED.has(tf))throw Error('Invalid cTrader symbol/timeframe');
 const params=new URLSearchParams({symbol,interval:tf,limit:String(limit)});
 const body=await get('/candles?'+params);
 if(!Array.isArray(body.candles)||!body.candles.length)throw Error('cTrader broker returned no bars');
 return {candles:body.candles,source:'rest',note:'CTRADER · Authorized broker REST refresh (60s)',aggregated:false,lastUpdate:body.lastUpdate};
}
export function pollCtrader(symbol,tf,onCandle,onStatus){
 let active=true,busy=false;onStatus?.('polling');
 const timer=setInterval(async()=>{
  if(!active||busy)return;busy=true;
  try{const result=await ctraderCandles(symbol,tf,2);if(active){const bar=result.candles.at(-1);if(bar)onCandle?.(bar);onStatus?.('polling')}}
  catch(e){if(active)onStatus?.('error','cTrader REST refresh failed: '+e.message)}finally{busy=false}
 },60000);
 return ()=>{active=false;clearInterval(timer)};
}