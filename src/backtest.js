import {ema} from './indicators.js';
export function emaBacktest(candles,{fast=9,slow=21,capital=1000,feePercent=0.1}={}){
 if(!Number.isInteger(fast)||!Number.isInteger(slow)||fast<1||slow<=fast)throw Error('Fast EMA harus lebih kecil dari Slow EMA');
 if(!(capital>0)||feePercent<0||feePercent>=100)throw Error('Modal atau biaya tidak valid');
 if(candles.length<=slow+3)throw Error('Data candle tidak cukup');
 const f=ema(candles.map(c=>c.close),fast),s=ema(candles.map(c=>c.close),slow);let cash=capital,qty=0,entryPrice=0,entryTime=0,invested=0,fees=0;let peak=capital,maxDD=0;const trades=[];const rate=feePercent/100;
 // Signal only after candle i closes. Fill at next candle open. No lookahead.
 for(let i=slow;i<candles.length;i++){
  const prev=i-1;
  if(f[prev]===null||s[prev]===null||f[prev-1]===null||s[prev-1]===null)continue;
  const crossUp=f[prev]>s[prev]&&f[prev-1]<=s[prev-1];const crossDown=f[prev]<s[prev]&&f[prev-1]>=s[prev-1];const price=candles[i].open;
  if(qty>0&&crossDown){const gross=qty*price;const sellFee=gross*rate;cash=gross-sellFee;fees+=sellFee;trades.push({entryTime,exitTime:candles[i].time,entry:entryPrice,exit:price,pnl:cash-invested,pnlPercent:100*(cash-invested)/invested});qty=0;invested=0;}
  else if(qty===0&&crossUp){invested=cash;const buyFee=cash*rate;fees+=buyFee;qty=(cash-buyFee)/price;entryPrice=price;entryTime=candles[i].time;cash=0;}
  const equity=qty>0?qty*candles[i].close:cash;peak=Math.max(peak,equity);maxDD=Math.max(maxDD,100*(peak-equity)/peak);
 }
 const last=candles.at(-1),equity=qty>0?qty*last.close:cash;const openPnl=qty>0?equity-invested:0;const wins=trades.filter(t=>t.pnl>0).length;return{equity,returnPct:100*(equity/capital-1),closedTrades:trades.length,winRate:trades.length?100*wins/trades.length:0,maxDD,fees,openPosition:qty>0,openPnl,trades};
}
