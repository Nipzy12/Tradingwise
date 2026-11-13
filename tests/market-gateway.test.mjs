import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketCatalog,normalizeSymbols,normalizeBiquoteOhlc,aggregateWeekly,parseMarketId,readCandles,tickFromBiquote,applyTickToCandle,validateInterval} from '../server/providers.mjs';
import {BiquoteHub,BinanceStreams} from '../server/streams.mjs';
import {buildServer} from '../server/index.mjs';
const base=Date.UTC(2026,9,1);
const bins=[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING'},{symbol:'ETHUSDT',baseAsset:'ETH',quoteAsset:'USDT',status:'TRADING'},{symbol:'LUMAXYZ',baseAsset:'LUMA',quoteAsset:'XYZ',status:'BREAK'}];
const biqs=[{name:'XAUUSD',description:'Gold / US Dollar',type:'Commodity',source:'MT5',exchange:'Forex'},{name:'EURUSD',description:'Euro / Dollar',type:'Forex',source:'MT5',exchange:'Forex'},{name:'BTCUSD',description:'Bitcoin CFD',type:'Crypto',source:'MT5',exchange:'CFD'},{name:'TEST.STK',description:'Stock CFD',type:'Stock',source:'MATRIKS',exchange:'Stocks',isActive:false}];
const mockBars=Array.from({length:220},(_,i)=>({openTime:new Date(base+i*86400000).toISOString(),open:100+i,high:102+i,low:98+i,close:101+i,volume:10,isOpen:i===219})).reverse();
const klines=Array.from({length:220},(_,i)=>[base+i*3600e3,100+i,102+i,98+i,101+i,15]);
let expectedCalls=[];
function mockFetch(url,opts){
 expectedCalls.push({url:String(url),method:opts?.method||'GET'});
 let payload,status=200;
 if(String(url).includes('exchangeInfo'))payload={symbols:bins};
 else if(String(url).endsWith('/api/symbols'))payload=biqs;
 else if(String(url).includes('/api/v3/klines'))payload=klines;
 else if(String(url).includes('/ohlc?'))payload={bars:mockBars,symbol:'XAUUSD',interval:'1d'};
 else if(String(url).includes('ticker/24hr'))payload=[{symbol:'BTCUSDT',lastPrice:'101.1',priceChangePercent:'3.1'}];
 else if(String(url).includes('/api/latest'))payload=[{symbol:'XAUUSD',mid:4100,bid:4099,ask:4101,timestamp:new Date().toISOString(),marketState:'closed',stale:true,dayDiffPercent:-0.1}];
 else if(String(url).includes('negotiate'))payload={connectionToken:'test-token',availableTransports:[{transport:'WebSockets'}]};
 else{status=404;payload={error:'not found'};}
 return Promise.resolve({ok:status>=200&&status<300,status,json:async()=>payload});
}
class FakeWebSocket {
 static opened=[];
 constructor(url){this.url=String(url);this.events=new Map();this.sent=[];FakeWebSocket.opened.push(this);queueMicrotask(()=>this.emit('open',{}))}
 addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn)}
 emit(name,obj){for(const fn of this.events.get(name)||[])fn(obj)}
 send(x){this.sent.push(x);if(x.includes('"protocol":"json"'))queueMicrotask(()=>this.emit('message',{data:'{}\x1e'}))}
 close(){queueMicrotask(()=>this.emit('close',{}))}
}
const waitFor=(predicate,time=1500)=>new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(predicate())resolve();else if(Date.now()-start>time)reject(Error('Timeout'));else setTimeout(check,5)};check()});

test('provider catalogs keep all instruments and collisions separated',async()=>{
 const items=normalizeSymbols('BINANCE',{symbols:bins});const other=normalizeSymbols('BIQUOTE',biqs);
 assert.equal(items.length,3);assert.equal(other.length,4);assert.equal(items.at(-1).provider,'BINANCE');
 assert.ok(other.find(x=>x.id==='BIQUOTE:BTCUSD'));assert.equal(other.find(x=>x.symbol==='TEST.STK').status,'INACTIVE');
 assert.equal(parseMarketId('BINANCE:btcusdt').id,'BINANCE:BTCUSDT');assert.throws(()=>parseMarketId('https://evil.local/evil'));
});

test('catalog searchable in full, paginated and provider scoped',async()=>{
 const cat=new MarketCatalog({fetchFn:mockFetch});const data=await cat.search({provider:'ALL',q:'USD',limit:2});
 assert.equal(data.total,5);assert.equal(data.items.length,2);assert.equal(data.counts.BINANCE,3);assert.equal(data.counts.BIQUOTE,4);
 assert.equal((await cat.search({provider:'BIQUOTE',q:'Stock'})).total,1);
 await assert.rejects(()=>cat.lookup('BINANCE:NOTLISTED'),/tidak ditemukan/);
});

test('historical Biquote candles normalized and weekly aggregated from daily',async()=>{
 const cat=new MarketCatalog({fetchFn:mockFetch});const data=await readCandles({id:'BIQUOTE:XAUUSD',interval:'1w',limit:90,catalog:cat,fetchFn:mockFetch});
 assert.equal(data.aggregated,true);assert.ok(data.candles.length>25);assert.ok(data.candles.every((b,i)=>i===0||b.time>data.candles[i-1].time));
 assert.ok(expectedCalls.some(c=>c.url.includes('/ohlc?interval=1d')));
 assert.throws(()=>validateInterval('BIQUOTE','3m'),/tidak tersedia/);
 const bin=await readCandles({id:'BINANCE:BTCUSDT',interval:'1h',limit:200,catalog:cat,fetchFn:mockFetch});assert.equal(bin.candles.length,200);
});

test('Biquote stale closed ticks never turn into new candle',()=>{
 const closed=tickFromBiquote({symbol:'EURUSD',mid:1.2,bid:1.199,ask:1.201,timestamp:'2026-11-13T02:30:00Z',marketState:'closed',stale:true});
 assert.equal(closed.price,1.2);assert.equal(applyTickToCandle(null,closed,'1m'),null);
 const live={...closed,marketState:'open',stale:false,time:Date.parse('2026-11-13T02:30:00Z')/1000};
 assert.equal(applyTickToCandle(null,live,'1m').open,1.2);
});

test('SignalR hub negotiates, sends handshake and Subscribe, routes ReceiveTick',async()=>{
 expectedCalls=[];FakeWebSocket.opened=[];const hub=new BiquoteHub({fetchFn:mockFetch,WebSocketImpl:FakeWebSocket});const received=[];
 const dispose=hub.subscribe('BIQUOTE:XAUUSD',x=>received.push(x));
 await waitFor(()=>hub.ready===true);const ws=FakeWebSocket.opened.at(-1);
 assert.ok(ws.url.includes('id=test-token'));assert.ok(ws.sent.some(x=>x.includes('"protocol":"json"')));assert.ok(ws.sent.some(x=>x.includes('"target":"Subscribe"')));
 ws.emit('message',{data:JSON.stringify({type:1,target:'ReceiveTick',arguments:[{symbol:'XAUUSD',mid:4050,bid:4049,ask:4051,timestamp:new Date().toISOString(),marketState:'open',stale:false}]})+'\x1e'});
 assert.equal(received.find(x=>x.type==='tick').price,4050);dispose();hub.close();
});

test('Binance WebSocket stream emits normalized kline to listeners',async()=>{
 FakeWebSocket.opened=[];const stream=new BinanceStreams({WebSocketImpl:FakeWebSocket});const received=[];
 const stop=stream.subscribe('BINANCE:BTCUSDT','1h',e=>received.push(e));
 await waitFor(()=>FakeWebSocket.opened.length>0);const ws=FakeWebSocket.opened[0];assert.ok(ws.url.includes('btcusdt@kline_1h'));
 ws.emit('message',{data:JSON.stringify({e:'kline',s:'BTCUSDT',k:{i:'1h',t:base,o:'10',h:'12',l:'9',c:'11',v:'6',x:false}})});
 assert.ok(received.some(e=>e.type==='candle'&&e.bar.close===11));stop();stream.close();
});

test('backend HTTP exposes searchable full catalog and real-provider-only candles',async()=>{
 const gateway=buildServer({fetchFn:mockFetch,WebSocketImpl:FakeWebSocket});
 await new Promise(done=>gateway.server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${gateway.server.address().port}`;
 try{
  const catalog=await (await fetch(origin+'/api/market/symbols?provider=ALL&q=USD&limit=40')).json();assert.equal(catalog.total,5);
  const candles=await (await fetch(origin+'/api/market/candles?symbol=BIQUOTE:XAUUSD&interval=1d')).json();assert.ok(candles.candles.length>100);
  const missing=await fetch(origin+'/api/market/candles?symbol=BIQUOTE:MADEUP&interval=1d');assert.equal(missing.status,404);
  const invalid=await fetch(origin+'/api/market/candles?symbol=https%3A%2F%2Fevil.example%2F&interval=1h');assert.equal(invalid.status,400);
  const tickers=await (await fetch(origin+'/api/market/tickers?symbols=BINANCE:BTCUSDT,BIQUOTE:XAUUSD')).json();assert.equal(tickers.items.length,2);
  const html=await fetch(origin+'/index.html');assert.equal(html.status,200);
  assert.ok((await html.text()).includes('LUMAVUN'));
  const client=new WebSocket(origin.replace('http:','ws:')+'/ws/market');const packets=[];
  client.addEventListener('message',e=>packets.push(JSON.parse(String(e.data))));
  await new Promise((resolve,reject)=>{client.addEventListener('open',resolve,{once:true});client.addEventListener('error',reject,{once:true})});
  client.send(JSON.stringify({action:'subscribe',symbol:'BINANCE:BTCUSDT',interval:'1h'}));
  await waitFor(()=>packets.some(p=>p.type==='status'&&p.status==='connected'))
  const upstream=FakeWebSocket.opened.filter(x=>x.url.includes('btcusdt@kline_1h')).at(-1);
  upstream.emit('message',{data:JSON.stringify({e:'kline',s:'BTCUSDT',k:{i:'1h',t:base,o:'10',h:'12',l:'9',c:'11',v:'6',x:false}})});
  await waitFor(()=>packets.some(p=>p.type==='candle'&&p.bar.close===11))
  client.close();
 }finally{await gateway.close()}
});
