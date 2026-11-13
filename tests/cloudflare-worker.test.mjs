import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../edge/worker.mjs';

const request=(path,method='GET',origin)=>new Request('https://example.workers.dev'+path,{method,headers:origin?{Origin:origin}:{}});

test('Worker health explicitly lists free-tier limitations',async()=>{
 const response=await worker.fetch(request('/api/market/health'),{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.ok,true);assert.equal(body.synthetic,false);
 assert.match(body.alerts,/node/i);
});
test('Market API rejects invalid or unsupported market identifiers',async()=>{
 let response=await worker.fetch(request('/api/market/candles?symbol=HTTP://PRIVATE&interval=1h'),{});
 assert.equal(response.status,400);
 response=await worker.fetch(request('/api/market/symbols?provider=WRONG'),{});
 assert.equal(response.status,400);
 response=await worker.fetch(request('/api/market/health','POST'),{});
 assert.equal(response.status,405);
});
test('Worker never exposes persistent alert management',async()=>{
 const response=await worker.fetch(request('/api/alerts/rules'),{});
 assert.equal(response.status,503);
});
test('WebSocket endpoint requires protocol upgrade',async()=>{
 const response=await worker.fetch(request('/ws/market'),{});
 assert.equal(response.status,426);
});
