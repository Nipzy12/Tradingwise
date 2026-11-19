import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOOL_CATALOG,TOOL_IDS,timeAt,logicalAt,anchor,normalizeDrawing,shiftDrawing,positionStats,seedPosition,fibPrices,clipLine,rangeStats} from '../src/drawing-model.js';
import {DrawingLayer} from '../src/drawings.js';
import {heikinAshi,toSeriesData} from '../src/chart-display.js';
import {normalizeUiPreferences,toggleFavorite} from '../src/ui-preferences.js';
const candles=Array.from({length:12},(_,i)=>({time:1700000000+i*60,open:100+i,high:104+i,low:98+i,close:103+i,volume:500+i}));
const p=(i,price)=>anchor(candles,i,price);
test('time-based anchors remain on original candle when older history is added or trimmed',()=>{
 const point=p(4,123),more=[{...candles[0],time:candles[0].time-60},...candles];
 assert.equal(logicalAt(more,point.time),5);assert.equal(logicalAt(candles.slice(2),point.time),2);
 assert.equal(timeAt(candles,2.5),candles[2].time+30);assert.equal(logicalAt(candles,timeAt(candles,-3)),-3);
});
test('legacy objects migrate and imported unsafe styles, coordinates, and malformed positions are rejected',()=>{
 const legacy=normalizeDrawing({id:'old',type:'trend',a:{logical:2,price:100},b:{logical:5,price:110},style:{color:'" onclick="bad',width:500}},candles);
 assert.equal(legacy.a.time,candles[2].time);assert.equal(legacy.style.color,'#598eff');assert.equal(legacy.style.width,20);
 assert.equal(normalizeDrawing({type:'trend',a:{logical:Infinity,price:1},b:p(1,2)},candles),null);
 assert.ok(normalizeDrawing({type:'trend',a:p(2,2),b:p(1,4),style:null},candles));
 assert.equal(normalizeDrawing({type:'long',a:p(1,100),b:p(4,90),c:p(4,95)},candles),null);
});
test('position uses independent native price targets, direction, RR, and contract-specific quantity',()=>{
 const a=p(2,100),b=p(7,110);const seeded=seedPosition('long',a,b,candles);
 assert.equal(seeded.b.price,110);assert.equal(seeded.c.price,95);
 const d=normalizeDrawing({type:'long',a,b,c:p(7,96),risk:{balance:1000,percent:2,contract:10}},candles);
 const stats=positionStats(d);assert.equal(stats.rr,2.5);assert.equal(stats.budget,20);assert.equal(stats.qty,.5);assert.equal(stats.targetPnL,50);
 const short=normalizeDrawing({type:'short',a,b:p(7,90),c:p(7,105)},candles);assert.equal(positionStats(short).rr,2);
 assert.equal(positionStats({...d,c:p(7,101)}),null);
});
test('Fibonacci prices and ranges are data-domain based and editable',()=>{
 const d=normalizeDrawing({type:'fibo',a:p(1,100),b:p(5,200),levels:[0,.5,1]},candles);
 assert.deepEqual(fibPrices(d).map(x=>x.price),[100,150,200]);
 const e=normalizeDrawing({type:'fibExtension',a:p(1,110),b:p(4,100),c:p(6,105),levels:[0,1,2]},candles);
 assert.deepEqual(fibPrices(e).map(x=>x.price),[105,95,85]);
 const s=rangeStats(d,candles);assert.equal(s.diff,100);assert.equal(s.percent,100);assert.equal(s.bars,4);assert.equal(s.seconds,240);
});
test('ray and extended line are clipped to plot boundaries, not prices/sidebar',()=>{
 const a={x:20,y:20},b={x:40,y:30};assert.deepEqual(clipLine(a,b,100,100,'ray'),[a,{x:100,y:60}]);
 assert.deepEqual(clipLine(a,b,100,100,'extended'),[{x:0,y:10},{x:100,y:60}]);
 assert.equal(clipLine({x:20,y:-5},{x:30,y:-5},100,100,'extended'),null);
});
test('moving a drawing translates each anchor without mutating the original',()=>{
 const d=normalizeDrawing({type:'triangle',a:p(1,100),b:p(3,105),c:p(4,98)},candles);
 const moved=shiftDrawing(d,candles,2,5);assert.equal(moved.a.time,candles[3].time);assert.equal(moved.c.price,103);assert.equal(d.a.price,100);assert.equal(d.c.logical,4);
});
function layer(){
 const l=Object.create(DrawingLayer.prototype);
 Object.assign(l,{chart:{candles},drawings:[],undoStack:[],redoStack:[],selected:null,templates:{},ready:true,tool:'trend',keepDrawing:true,preview:null,gesture:null,pending:null,render(){},syncControls(){},changed(){},capture(){},release(){},onToast(){},fromEvent(e){return e.point}});
 return l;
}
const event=(i,price)=>({button:0,clientX:i*40,clientY:price,point:p(i,price),pointerType:'touch',target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
test('two-tap and drag placement create one drawing, multi-anchor tool waits until third point',()=>{
 const l=layer();
 let e=event(2,100);l.down(e);l.up(e);assert.equal(l.drawings.length,0);assert.equal(l.pending.anchors.length,1);
 e=event(5,110);l.down(e);l.up(e);assert.equal(l.drawings.length,1);assert.equal(l.drawings[0].b.price,110);assert.equal(l.pending,null);
 l.tool='channel';const a=event(1,100),b=event(5,105),c=event(6,110);l.down(a);l.move(b);l.up(b);assert.equal(l.drawings.length,1);assert.equal(l.pending.anchors.length,2);l.down(c);l.up(c);assert.equal(l.drawings.length,2);assert.equal(l.drawings[1].c.price,110);
});
test('actual layer edit, lock, hide, duplicate, undo and redo preserve independent snapshots',()=>{
 const l=layer(),id=l.add({type:'rectangle',a:p(1,100),b:p(3,110),style:{color:'#125678'}});
 assert.ok(id);assert.equal(l.update(id,{a:p(1,102)}),true);l.toggleFlag(id,'locked');assert.equal(l.drawings[0].locked,true);
 l.undo();assert.equal(l.drawings[0].locked,false);l.undo();assert.equal(l.drawings[0].a.price,100);l.redo();assert.equal(l.drawings[0].a.price,102);
 l.toggleFlag(id,'hidden');assert.equal(l.drawings[0].hidden,true);const copy=l.duplicate(id);assert.notEqual(copy,id);assert.equal(l.drawings[1].hidden,false);l.remove(id);assert.equal(l.drawings.length,1);l.undo();assert.equal(l.drawings.length,2);
});
test('brush gesture records a path and undo removes it',()=>{
 const l=layer();l.tool='brush';const a=event(1,100),b=event(2,102),c=event(3,99);l.down(a);l.move(b);l.move(c);l.up(c);
 assert.equal(l.drawings.length,1);assert.equal(l.drawings[0].points.length,3);l.undo();assert.equal(l.drawings.length,0);
});
test('new drawing tools can be favorited; modes and invalid tools cannot be pinned',()=>{
 let prefs=normalizeUiPreferences();prefs=toggleFavorite(prefs,'tools','fvgZone');assert.ok(prefs.favorites.tools.includes('fvgZone'));assert.ok(TOOL_IDS.length>=25);assert.ok(TOOL_CATALOG.channel.points===3);assert.throws(()=>toggleFavorite(prefs,'tools','eraser'));
});
test('line and area get value data; Heikin Ashi transforms without changing original OHLC',()=>{
 const original=JSON.stringify(candles);assert.deepEqual(toSeriesData(candles.slice(0,1),'line'),[{time:candles[0].time,value:103}]);
 const d=heikinAshi(candles);assert.equal(d[0].open,101.5);assert.equal(d[0].close,101.25);assert.equal(d[1].open,(d[0].open+d[0].close)/2);assert.equal(JSON.stringify(candles),original);
 assert.equal(toSeriesData(candles,'bars')[0].close,103);
});
test('drawing studio is wired across mobile, desktop and object tree; original provider modules remain used',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),mobile=readFileSync(new URL('../src/mobile-ui.js',import.meta.url),'utf8');
 for(const id of ['drawingToolsBtn','drawingQuickBar','drawingHint','keepDrawingBtn','lockDrawingsBtn','drawingDataValues'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(mobile,/ui\.drawingToolsModal\(\)/);assert.match(app,/openDrawingProperties/);assert.match(app,/drawingLayer\.setReady\(false\)/);assert.match(app,/subscribeMarket\(/);
});
