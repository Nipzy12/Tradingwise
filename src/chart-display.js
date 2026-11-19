// Display transforms only; provider OHLC remains the source for alerts, drawings and backtests.
export const CHART_TYPES=['candles','bars','heikin','line','area'];
export function heikinAshi(candles){
 let previous=null;
 return candles.map(bar=>{const close=(bar.open+bar.high+bar.low+bar.close)/4,open=previous?(previous.open+previous.close)/2:(bar.open+bar.close)/2;
  const next={...bar,open,close,high:Math.max(bar.high,open,close),low:Math.min(bar.low,open,close)};previous=next;return next});
}
export function displayCandles(candles,type){return type==='heikin'?heikinAshi(candles):candles}
export function toSeriesData(candles,type){
 const view=displayCandles(candles,type);
 if(type==='line'||type==='area')return view.map(({time,close})=>({time,value:close}));
 return view.map(({time,open,high,low,close})=>({time,open,high,low,close}));
}
