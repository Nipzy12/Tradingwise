import test from 'node:test';
import assert from 'node:assert/strict';
import {GALLERY_GROUPS,galleryGroups} from '../src/drawing-gallery.js';
import {TOOL_IDS,normalizeDrawing,anchor,shiftDrawing} from '../src/drawing-model.js';
import {linearRegression,anchoredVwap} from '../src/drawing-extra.js';
test('gallery follows category order and empty favorites; search includes English and Indonesian names',()=>{
 assert.deepEqual(GALLERY_GROUPS.slice(0,8).map(x=>x[0]),['Peralatan','Peralatan Tren','Gann dan Fibonacci','Motif','Proyeksi dan pengukuran','Bentuk-bentuk geometris','Anotasi','Visual']);
 assert.deepEqual(galleryGroups('Favorit','',[]),[]);
 assert.equal(galleryGroups('Favorit','',''.split('')).length,0);
 assert.ok(galleryGroups('Favorit','Horizontal line',[]).flatMap(g=>g[1]).some(t=>t.id==='horizontal'));
 assert.ok(galleryGroups('Favorit','garis tren',[]).flatMap(g=>g[1]).some(t=>t.id==='trend'));
 assert.equal(galleryGroups('Favorit','',['triangle']).flatMap(g=>g[1]).length,1);
 for(const t of GALLERY_GROUPS.flatMap(g=>g[1]))if(t.pinnable)assert.ok(TOOL_IDS.includes(t.id)&&t.available);
});
test('multi-anchor Elliott objects retain six points and move every anchor',()=>{
 const candles=Array.from({length:12},(_,i)=>({time:1000+i*60,close:i+10}));const d=normalizeDrawing({type:'elliottImpulse',...Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,anchor(candles,i,i+10)]))},candles);
 assert.equal(d.f.price,15);const moved=shiftDrawing(d,candles,1,2);assert.equal(moved.f.price,17);assert.equal(moved.f.logical,6);
});
test('regression and anchored VWAP use candle data rather than dummy drawing outputs',()=>{
 assert.deepEqual(linearRegression([10,12,14]),{slope:2,intercept:10,sd:0});
 const rows=[{time:1,high:10,low:10,close:10,volume:1},{time:2,high:20,low:20,close:20,volume:3}];assert.equal(anchoredVwap(rows,0)[1].price,17.5);assert.equal(anchoredVwap(rows,1)[0].price,20);assert.equal(anchoredVwap([{...rows[0],volume:0}],0)[0].price,null);
});
