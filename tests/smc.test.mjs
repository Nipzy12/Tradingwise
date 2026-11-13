import test from 'node:test';
import assert from 'node:assert/strict';
import {SMC_DEFAULTS,SMC_ID,smcSettings,computeSMC,aggregateHtf,atrSeries} from '../src/smc.js';
import {seededDemo} from './fixtures/synthetic.mjs';
import {CATALOG} from '../src/indicators.js';
const data=seededDemo('BTCUSDT','15m',650);
const settings={htfMode:'Off',qualityMode:'Longgar'};
test('SMC appears in selectable indicator catalog',()=>assert.ok(CATALOG.some(c=>c.id===SMC_ID)));
test('SMC settings clamp values and preserve only recognized keys',()=>{
 const s=smcSettings({swingLen:1000,rrTarget:-10,htfMode:'FOO',useM1:false,malicious:'x'});
 assert.equal(s.swingLen,20);assert.equal(s.rrTarget,.5);assert.equal(s.htfMode,SMC_DEFAULTS.htfMode);assert.equal(s.useM1,false);assert.equal('malicious' in s,false);
});
test('ATR uses Wilder smoothing after 14 bars',()=>{const a=atrSeries(data);assert.equal(a.slice(0,13).every(v=>v===null),true);assert.ok(a[13]>0&&a.at(-1)>0)});
test('Aggregated HTF candle has OHLC and volume from underlying LTF candles',()=>{
 const a=aggregateHtf(data,4*3600),g=a.find(x=>x.lastIndex>x.firstIndex);
 assert.ok(g);const source=data.slice(g.firstIndex,g.lastIndex+1);
 assert.equal(g.open,source[0].open);assert.equal(g.close,source.at(-1).close);
 assert.equal(g.high,Math.max(...source.map(x=>x.high)));
 assert.equal(g.volume,source.reduce((sum,x)=>sum+x.volume,0));
});
test('SMC creates structures and M1 plan from deterministic closed candles',()=>{
 const r=computeSMC(data,settings,'15m');assert.ok(r.structures.length>0);assert.ok(r.stats.buyPlans>0);
 assert.ok(r.events.some(e=>e.reason==='plan'&&e.model.startsWith('M1')));
});
test('SMC no-lookahead: future bars do not change previous closed-bar events',()=>{
 const upto=400;const a=computeSMC(data.slice(0,upto),settings,'15m');const b=computeSMC(data,settings,'15m');
 const filtered=b.events.filter(e=>e.bar<upto).map(({bar,reason,model,side})=>({bar,reason,model,side}));
 assert.deepEqual(a.events.map(({bar,reason,model,side})=>({bar,reason,model,side})),filtered);
});
test('SMC only fills an order on a later candle and freezes lines at SL/TP hit',()=>{
 const prefix=data.slice(0,385),base=computeSMC(prefix,settings,'15m');const pending=base.pending.find(p=>p.model==='M1 SWEEP+OB');assert.ok(pending);
 const after={...data[385],open:pending.entry+130,low:pending.entry-3,high:pending.entry+160,close:pending.entry+100};
 const entryResult=computeSMC([...prefix,after],settings,'15m');
 assert.equal(entryResult.stats.entries,1);
 assert.equal(entryResult.trades[0].born,385);
 assert.equal(entryResult.trades[0].status,0);
 const stopCandle={...data[386],open:pending.entry,high:pending.tp+50,low:pending.sl-50,close:pending.entry};
 const ended=computeSMC([...prefix,after,stopCandle],settings,'15m');
 assert.equal(ended.trades[0].status,-1);assert.equal(ended.trades[0].end,386);
 assert.equal(ended.stats.sl,1);assert.equal(ended.stats.tp,0);
});
test('SMC rejects equal/smaller higher timeframe with visible warning',()=>{
 const r=computeSMC(data,{htfMode:'Bias',htfTF:'1h'},'4h');
 assert.match(r.warning,/harus lebih besar/);assert.equal(r.events.length,0);
});
test('SMC excludeLast ignores unclosed/modified candle',()=>{
 const a=computeSMC(data,settings,'15m',{excludeLast:true});const edited=[...data];edited[649]={...data[649],high:data[649].high*5,low:0.01,close:400000};
 const b=computeSMC(edited,settings,'15m',{excludeLast:true});assert.deepEqual(a,b);
});
