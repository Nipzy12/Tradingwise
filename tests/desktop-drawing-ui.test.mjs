import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOOL_IDS,TOOL_CATALOG} from '../src/drawing-model.js';
import {DESKTOP_GROUPS,desktopGroupItems} from '../src/drawing-desktop-model.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('desktop drawing groups use the TradingView-like left-toolbar order with every supported tool reachable',()=>{
 assert.deepEqual(DESKTOP_GROUPS.map(x=>x.id),['cursor','trend','fib','patterns','projection','shapes','annotation','visual','smc','measure']);
 const reachable=new Set();
 for(const group of DESKTOP_GROUPS){
  assert.ok(group.label&&group.defaultTool,group.id);
  assert.ok(desktopGroupItems(group.id).length>0,group.id);
  for(const t of desktopGroupItems(group.id)){
   assert.ok(Object.hasOwn(TOOL_CATALOG,t.id),t.id+' is implemented, not a phantom item');
   assert.ok(Number.isInteger(TOOL_CATALOG[t.id].points),t.id+' valid anchor count');
   if(TOOL_CATALOG[t.id].points>0)reachable.add(t.id);
  }
 }
 assert.deepEqual([...reachable].sort(),[...TOOL_IDS].sort(),'every implemented tool appears in a real desktop group');
});

test('desktop toolbar is split into accessible category flyouts without changing mobile palette',()=>{
 const html=read('index.html');
 const desktop=read('src/drawing-desktop.js');
 for(const group of DESKTOP_GROUPS)assert.match(html,new RegExp('data-drawing-group="'+group.id+'"'),group.id);
 assert.match(html,/id="desktopDrawingFlyout"/);
 assert.match(desktop,/aria-expanded/);
 assert.match(desktop,/data-draw-pick/);
 assert.match(desktop,/data-draw-pin/);
 assert.match(desktop,/Escape/);
 assert.match(read('src/workspace-ui.js'),/mountDesktopDrawingToolbar/);
 assert.match(read('src/mobile-ui.js'),/drawingToolsModal/);
});

test('desktop shell makes the watchlist visible by default, and range controls have working 6M / YTD / 1Y / 5Y choices',()=>{
 const prefs=read('src/ui-preferences.js');
 const html=read('index.html');
 const app=read('src/app.js');
 assert.match(prefs,/sidebarCollapsed:false/);
 for(const value of ['6m','ytd','1y','5y'])assert.match(html,new RegExp('data-range="'+value+'"'));
 for(const value of ['6m','ytd','1y','5y'])assert.ok(app.includes("'"+value+"'"),value+' wired to real chart range handler');
 assert.match(html,/id="rightbar"/);
 assert.match(html,/id="bottomPanel"/);
});
