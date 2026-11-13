// cTrader Open API read-only JSON protocol, no credentials stored in source.
export const PROTO=Object.freeze({APP_AUTH_REQ:2100, APP_AUTH_RES:2101,ACCOUNT_AUTH_REQ:2102,ACCOUNT_AUTH_RES:2103,SYMBOLS_REQ:2114,SYMBOLS_RES:2115,SPOT_REQ:2127,SPOT_EVENT:2131,TRENDBARS_REQ:2137,TRENDBARS_RES:2138,ERROR:2142,ACCOUNT_LIST_REQ:2149,ACCOUNT_LIST_RES:2150});
export const TIMEFRAMES=Object.freeze({'1m':{period:1,seconds:60},'3m':{period:3,seconds:180},'5m':{period:5,seconds:300},'15m':{period:7,seconds:900},'30m':{period:8,seconds:1800},'1h':{period:9,seconds:3600},'4h':{period:10,seconds:14400},'1d':{period:12,seconds:86400},'1w':{period:13,seconds:604800}});
export function normalizeTrendbars(rows,tf,nowMs=Date.now()) {
 const secs=TIMEFRAMES[tf]?.seconds;
 if(!secs)throw Error('Unsupported timeframe');
 return (Array.isArray(rows)?rows:[]).map(b=>{
  const low=Number(b.low),time=Number(b.utcTimestampInMinutes)*60;
  const bar={time,open:(low+Number(b.deltaOpen||0))/1e5,high:(low+Number(b.deltaHigh||0))/1e5,low:low/1e5,close:(low+Number(b.deltaClose||0))/1e5,volume:Number(b.volume||0),isOpen:(time+secs)*1000>nowMs};
  return bar;
 }).filter(b=>Number.isSafeInteger(b.time)&&b.time>0&&[b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)&&b.low<=b.open&&b.low<=b.close&&b.high>=b.open&&b.high>=b.close)
 .sort((a,b)=>a.time-b.time).filter((v,i,a)=>i===0||v.time!==a[i-1].time);
}
export function ctraderId(accountId,symbolId){
 if(!/^\d{1,20}$/.test(String(accountId))||!/^\d{1,20}$/.test(String(symbolId)))throw Error('Invalid account/symbol ID');
 return `CTRADER:${accountId}:${symbolId}`;
}
export function parseCtraderId(value){
 const m=/^CTRADER:(\d{1,20}):(\d{1,20})$/.exec(String(value));
 if(!m)throw Error('Invalid cTrader symbol identifier');
 return {accountId:m[1],symbolId:m[2]};
}
export function lightSymbols(data,accountId){
 return (data?.symbol||[]).filter(s=>s?.symbolId!=null&&s?.symbolName!==undefined||s?.name&&s?.symbolId!=null).map(s=>({
  id:ctraderId(accountId,s.symbolId),provider:'CTRADER',symbol:String(s.symbolName||s.name),name:String(s.description||s.name||s.symbolName),market:'Broker',exchange:'cTrader',source:'cTrader Open API',status:s.enabled===false?'INACTIVE':'LISTED',symbolId:String(s.symbolId),accountId:String(accountId),digits:s.digits??5
 }));
}