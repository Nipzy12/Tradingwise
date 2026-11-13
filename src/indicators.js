export function sma(values,length){
 const out=Array(values.length).fill(null);if(!Number.isInteger(length)||length<1)return out;
 let sum=0;for(let i=0;i<values.length;i++){sum+=values[i];if(i>=length)sum-=values[i-length];if(i>=length-1)out[i]=sum/length;}return out;
}
export function ema(values,length){
 const out=Array(values.length).fill(null);if(!Number.isInteger(length)||length<1||values.length<length)return out;
 const a=2/(length+1);let prev=0;for(let i=0;i<length;i++)prev+=values[i];prev/=length;out[length-1]=prev;
 for(let i=length;i<values.length;i++){prev=(values[i]-prev)*a+prev;out[i]=prev;}return out;
}
export function rsi(values,length=14){
 const out=Array(values.length).fill(null);if(values.length<=length||length<1)return out;
 let ups=0,downs=0;
 for(let i=1;i<=length;i++){const d=values[i]-values[i-1];if(d>0)ups+=d;else downs-=d;}
 let ag=ups/length,al=downs/length;
 out[length]=al===0?(ag===0?50:100):100-100/(1+ag/al);
 for(let i=length+1;i<values.length;i++){
  const d=values[i]-values[i-1];ag=(ag*(length-1)+Math.max(d,0))/length;al=(al*(length-1)+Math.max(-d,0))/length;
  out[i]=al===0?(ag===0?50:100):100-100/(1+ag/al);
 }return out;
}
export function bollinger(values,length=20,mult=2){
 const mid=sma(values,length),top=Array(values.length).fill(null),bottom=Array(values.length).fill(null);
 for(let i=length-1;i<values.length;i++){const avg=mid[i];let sum=0;for(let j=i-length+1;j<=i;j++)sum+=(values[j]-avg)**2;const sd=Math.sqrt(sum/length);top[i]=avg+mult*sd;bottom[i]=avg-mult*sd;}
 return {mid,top,bottom};
}
export function macd(values,fast=12,slow=26,signal=9){
 const f=ema(values,fast),s=ema(values,slow),line=Array(values.length).fill(null),sig=Array(values.length).fill(null),hist=Array(values.length).fill(null);
 const valid=[];const indices=[];for(let i=0;i<values.length;i++){if(f[i]!==null&&s[i]!==null){line[i]=f[i]-s[i];valid.push(line[i]);indices.push(i);}}
 const out=ema(valid,signal);for(let i=0;i<out.length;i++){if(out[i]!==null){const k=indices[i];sig[k]=out[i];hist[k]=line[k]-sig[k];}}return {line,signal:sig,hist};
}
export function vwap(candles){let pv=0,v=0;return candles.map(c=>{pv+=((c.high+c.low+c.close)/3)*c.volume;v+=c.volume;return v>0?pv/v:null})}
export function indicatorLines(candles,enabled=[],custom=[]){
 const closes=candles.map(c=>c.close), t=candles.map(c=>c.time),lines=[];
 const add=(key,name,values,color,pane='main',kind='line')=>lines.push({key,name,color,pane,kind,values:values.map((v,i)=>v===null||!Number.isFinite(v)?null:{time:t[i],value:v}).filter(Boolean)});
 if(enabled.includes('ema9'))add('ema9','EMA 9',ema(closes,9),'#efb44e');
 if(enabled.includes('ema21'))add('ema21','EMA 21',ema(closes,21),'#957bf5');
 if(enabled.includes('sma20'))add('sma20','SMA 20',sma(closes,20),'#44a6ee');
 if(enabled.includes('bb')){const b=bollinger(closes);add('bbmid','BB Basis',b.mid,'#b6b3cc');add('bbup','BB Upper',b.top,'#767df6');add('bblo','BB Lower',b.bottom,'#767df6');}
 if(enabled.includes('vwap'))add('vwap','VWAP',vwap(candles),'#e7ce73');
 if(enabled.includes('volume'))add('volume','Volume',candles.map(c=>c.volume),'#7893b1','volume','histogram');
 if(enabled.includes('rsi'))add('rsi','RSI 14',rsi(closes,14),'#a687f4','rsi');
 if(enabled.includes('macd')){const m=macd(closes);add('macd','MACD',m.line,'#6ca4ed','macd');add('macdsig','Signal',m.signal,'#e7a54f','macd');add('macdhist','Histogram',m.hist,'#668fbc','macd','histogram');}
 for(const series of custom){try{if(series.values.length===candles.length)add(series.key,series.name,series.values,series.color,series.pane||'main');}catch{}}
 return lines;
}
export const CATALOG=[
 {id:'smc-entry-pro-v5',name:'SMC Entry Models PRO v5 | Follow Candle',category:'Smart Money Concepts',desc:'3 models · Sweep / BOS / CHoCH · OB / FVG · HTF · Entry/SL/TP (JS adapter)'},
 {id:'ema9',name:'Exponential Moving Average (9)',category:'Moving Averages',desc:'EMA 9 pada chart utama'},
 {id:'ema21',name:'Exponential Moving Average (21)',category:'Moving Averages',desc:'EMA 21 pada chart utama'},
 {id:'sma20',name:'Simple Moving Average (20)',category:'Moving Averages',desc:'SMA 20 pada chart utama'},
 {id:'bb',name:'Bollinger Bands (20, 2)',category:'Volatility',desc:'Upper, middle dan lower bands'},
 {id:'vwap',name:'Volume Weighted Average Price',category:'Volume',desc:'VWAP dari data candle yang dimuat'},
 {id:'volume',name:'Volume',category:'Volume',desc:'Histogram volume transaksi'},
 {id:'rsi',name:'Relative Strength Index (14)',category:'Oscillators',desc:'RSI dalam pane terpisah'},
 {id:'macd',name:'Moving Average Convergence Divergence',category:'Oscillators',desc:'MACD, signal dan histogram'},
];
