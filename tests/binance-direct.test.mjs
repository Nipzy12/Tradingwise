import test from 'node:test';
import assert from 'node:assert/strict';
import {binanceSearch,binanceCandles,binanceTickers} from '../src/binance-direct.js';

test('Direct Binance catalog exposes provider-qualified symbols and supports search',async()=>{
 const before=globalThis.fetch;
 globalThis.fetch=async input=>{
  assert.match(String(input),/exchangeInfo/);
  return new Response(JSON.stringify({symbols:[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING'},{symbol:'ETHUSDT',baseAsset:'ETH',quoteAsset:'USDT',status:'TRADING'}]}),{status:200});
 };
 try{
  const r=await binanceSearch('BTC',50,0);
  assert.equal(r.total,1);assert.equal(r.items[0].id,'BINANCE:BTCUSDT');assert.equal(r.counts.BINANCE,2);
 }finally{globalThis.fetch=before}
});
test('Direct Binance candles normalize OHLC, do not fabricate prices',async()=>{
 const before=globalThis.fetch;
 globalThis.fetch=async input=>{
  assert.match(String(input),/\/api\/v3\/klines/);
  return new Response(JSON.stringify([[1794000000000,'100','110','90','105','12']]),{status:200});
 };
 try{
  const r=await binanceCandles('BINANCE:BTCUSDT','1h',30);
  assert.equal(r.candles.length,1);assert.deepEqual([r.candles[0].open,r.candles[0].high,r.candles[0].low,r.candles[0].close],[100,110,90,105]);
 }finally{globalThis.fetch=before}
});
test('Direct Binance ticker provides actual provider-qualified symbol',async()=>{
 const before=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify([{symbol:'BTCUSDT',lastPrice:'100',priceChangePercent:'2'}]),{status:200});
 try{
  const r=await binanceTickers(['BINANCE:BTCUSDT','BIQUOTE:XAUUSD']);
  assert.equal(r[0].symbol,'BINANCE:BTCUSDT');assert.equal(r[0].last,100);
 }finally{globalThis.fetch=before}
});
