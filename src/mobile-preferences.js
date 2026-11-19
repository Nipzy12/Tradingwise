// Mobile chart navigation and quote display. Never alters original market OHLC.
export const MOBILE_TIMEFRAMES=['1m','3m','5m','15m','30m','1h','2h','4h','1d','1w'];
export const CURRENCIES=['USD','IDR','EUR','GBP','JPY','SGD','AUD','CAD','CHF','CNY','HKD','MYR','THB','INR','KRW','PHP','NZD'];
export const tfLabel=tf=>({'1d':'D1','1w':'W1','1h':'1H','2h':'2H','4h':'4H'})[tf]||tf;
export function supportsTimeframe(symbol,tf){
 return MOBILE_TIMEFRAMES.includes(tf)&&!(symbol.startsWith('BIQUOTE:')&&['3m','2h'].includes(tf))&&!(symbol.startsWith('CTRADER:')&&tf==='2h');
}
export function favoriteWheel(favorites,current,valid=()=>true){
 const values=[...new Set((Array.isArray(favorites)?favorites:[]).filter(x=>typeof x==='string'&&valid(x)))];
 // An explicitly selected nonfavorite remains visible, but is not added to favorites.
 if(current&&!values.includes(current))values.push(current);
 return values;
}
const CURRENCY_CODES=new Set([...CURRENCIES,'USDT','USDC','BTC','ETH','BNB','DAI','FDUSD','TRY','BRL','ZAR','NOK','SEK','DKK','MXN','PLN','CZK','HUF','ILS','RUB','AED','SAR','TWD','VND','XAU','XAG']);
export function nativeQuote(meta,symbol){
 const known=String(meta?.quoteAsset||'').toUpperCase();
 if(meta?.source!=='Unverified'&&/^[A-Z0-9]{2,12}$/.test(known))return known;
 const name=String(meta?.symbol||symbol?.split(':')[1]||'').toUpperCase();
 const token=[...CURRENCY_CODES].sort((a,b)=>b.length-a.length).find(q=>name.length>q.length&&name.endsWith(q));
 if(token&&(String(symbol).startsWith('BINANCE:')||[...CURRENCY_CODES].some(b=>b!==token&&name===b+token)))return token;
 return null;
}
export function readRate(payload,base,target){
 if(payload?.data?.currency!==base)throw Error('Mata uang sumber tidak sesuai');
 const rate=Number(payload.data.rates?.[target]);
 if(!Number.isFinite(rate)||rate<=0)throw Error('Kurs tidak tersedia');
 return rate;
}
export function makeDisplay(base,target,rate,updatedAt=Date.now()){
 if(!base||!target||!Number.isFinite(rate)||rate<=0)throw Error('Kurs tidak valid');
 return {base,target,rate,updatedAt,format(value){
   const n=Number(value)*rate;
   if(!Number.isFinite(n))return '–';
   const abs=Math.abs(n);
   return new Intl.NumberFormat('en-US',{minimumFractionDigits:abs>=1?2:0,maximumFractionDigits:abs>=1000?2:abs>=1?4:8}).format(n);
 }};
}
