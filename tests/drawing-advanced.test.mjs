import test from 'node:test';import assert from 'node:assert/strict';import {anchor,normalizeDrawing,shiftDrawing,TOOL_CATALOG,POINT_KEYS} from '../src/drawing-model.js';import {regression,anchoredVWAP,estimatedProfile,renderAdvanced} from '../src/drawing-advanced.js';import {paletteGroups} from '../src/drawing-palette-model.js';
const candles=Array.from({length:10},(_,i)=>({time:1700000000+i*60,open:100+i,close:100+i,high:101+i,low:99+i,volume:10}));
test('multi-anchor patterns preserve all anchors and can be moved',()=>{const raw={type:'elliottImpulse'};for(const [i,k] of POINT_KEYS.slice(0,6).entries())raw[k]=anchor(candles,i,100+i);const d=normalizeDrawing(raw,candles);assert.equal(d.f.price,105);assert.equal(shiftDrawing(d,candles,1,2).f.price,107);assert.equal(normalizeDrawing({...raw,f:null},candles),null)});
test('regression and VWAP use source candle data; volume profile conserves input volume',()=>{assert.equal(regression(candles).slope,1);assert.equal(regression(candles).sigma,0);assert.equal(anchoredVWAP(candles)[9],104.5);assert.equal(estimatedProfile(candles).values.reduce((a,b)=>a+b,0),100);assert.equal(estimatedProfile(candles.map(x=>({...x,volume:0}))),null)});
test('all reference categories now have implemented entries',()=>{for(const tab of ['tools','trend','fib','patterns','projection','shapes','annotation','visual','smc'])assert.ok(paletteGroups(tab).flatMap(g=>g.items).length>0);assert.ok(Object.keys(TOOL_CATALOG).length>65)});
test('advanced chart drawing branches render their geometry using native price/time points',()=>{const ids=['regression','fibCircle','xabcd','elliottImpulse','gannBox','anchoredVwap','fixedVolume','rotatedRectangle','circle','emoji'];for(const type of ids){const count=TOOL_CATALOG[type].points,raw={type,text:'Test'};for(const [i,k] of POINT_KEYS.slice(0,count).entries())raw[k]=anchor(candles,i+1,101+(i%3)*2);const d=normalizeDrawing(raw,candles),point=p=>p?{x:p.logical*20+10,y:200-p.price}:null,group=[];const add=(...v)=>group.push(v);const ok=renderAdvanced({d,a:point(d.a),b:point(d.b),c:point(d.c),right:500,bottom:300,line:add,label:add,rect:add,group,stroke:' stroke="#000"',style:d.style,color:d.style.color,chart:{candles,logicalToCoordinate:i=>i*20+10,priceToCoordinate:p=>200-p,formatPrice:String},point,n:x=>x,xy:p=>p.x+','+p.y,enc:String,round:x=>x});assert.ok(ok,type);assert.ok(group.length,type)}});

test('additional geometric Fibonacci and Gann tools are selectable and produce finite native chart geometry',()=>{
 const ids=[['fibSpiral',2],['gannSquare',2],['gannSquareFixed',2],['pitchfan',3]];
 for(const [type,count] of ids){
  assert.equal(TOOL_CATALOG[type]?.points,count,type+' is a supported drawing tool');
  assert.ok(paletteGroups('fib').flatMap(x=>x.items).includes(type),type+' is visible in correct category');
  const d={type};
  for(const [i,k] of POINT_KEYS.slice(0,count).entries())d[k]=anchor(candles,i+1,100+i*3);
  const object=normalizeDrawing(d,candles),group=[];
  const pt=p=>p?{x:30+(p.logical*28),y:350-p.price*2}:null;
  const line=(a,b)=>group.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>');
  const rect=(x1,y1,x2,y2)=>group.push('<rect x="'+x1+'" y="'+y1+'" width="'+Math.abs(x2-x1)+'" height="'+Math.abs(y2-y1)+'"/>');
  const chart={candles,logicalToCoordinate:l=>30+l*28,priceToCoordinate:p=>350-p*2,formatPrice:String};
  const done=renderAdvanced({d:object,a:pt(object.a),b:pt(object.b),c:pt(object.c),right:600,bottom:400,line,label:()=>{},rect,group,stroke:' stroke="#598eff"',style:object.style,color:object.style.color,chart,point:pt,n:x=>x,xy:p=>p.x+','+p.y,enc:String,round:x=>x});
  assert.equal(done,true,type+' rendered');
  if(type==='fibSpiral')assert.ok(group.some(s=>s.startsWith('<path')&&s.split(' L').length>40),type+' contains a continuous curved spiral');
  else assert.ok(group.length>2,type+' has independent visible geometry');
  assert.ok(!group.join('').includes('NaN'),type+' is finite');
 }
});
