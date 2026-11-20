// Real mobile Chromium viewport; only the market transport is mocked for reproducible UI QA.
// Run with npm install --no-save --no-package-lock playwright@1.65.1 lightweight-charts@5.0.8.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist');
const items=[
 {id:'BINANCE:BTCUSDT',provider:'BINANCE',symbol:'BTCUSDT',name:'Bitcoin / Tether',market:'Crypto',exchange:'Binance Spot',source:'Binance',quoteAsset:'USDT',status:'TRADING'},
 {id:'BIQUOTE:XAUUSD',provider:'BIQUOTE',symbol:'XAUUSD',name:'Gold / US Dollar',market:'Commodity',exchange:'Biquote',source:'Biquote',quoteAsset:'USD',status:'LISTED'},
 {id:'BIQUOTE:EURUSD',provider:'BIQUOTE',symbol:'EURUSD',name:'Euro / US Dollar',market:'Forex',exchange:'Biquote',source:'Biquote',quoteAsset:'USD',status:'LISTED'},
 {id:'BIQUOTE:USDJPY',provider:'BIQUOTE',symbol:'USDJPY',name:'US Dollar / Yen',market:'Forex',exchange:'Biquote',source:'Biquote',quoteAsset:'JPY',status:'LISTED'}
];
const sec={'1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,'1h':3600,'2h':7200,'4h':14400,'1d':86400,'1w':604800};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),q=url.searchParams;
 const json=o=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(o))};
 if(url.pathname==='/api/market/symbols'){const provider=q.get('provider'),needle=(q.get('q')||'').toLowerCase(),filtered=items.filter(i=>(provider==='ALL'||provider===i.provider)&&(i.symbol+' '+i.name).toLowerCase().includes(needle));const offset=Number(q.get('offset')||0);return json({items:filtered.slice(offset,offset+Number(q.get('limit')||50)),total:filtered.length,counts:{BINANCE:1,BIQUOTE:3},errors:{}})}
 if(url.pathname==='/api/market/candles'){const id=q.get('symbol'),interval=sec[q.get('interval')]||86400,base=id.startsWith('BINANCE')?63000:id.includes('XAU')?3700:id.includes('JPY')?150:1.1,step=base/1000,now=Math.floor(Date.now()/1000/interval)*interval;return json({provider:id.split(':')[0],candles:Array.from({length:200},(_,i)=>{const open=base+step*(Math.sin(i/10)*12+i/8),close=open+step*Math.sin(i*1.4);return {time:now-(199-i)*interval,open,high:Math.max(open,close)+step,low:Math.min(open,close)-step,close,volume:100+i,isOpen:i===199}}),aggregated:false})}
 if(url.pathname==='/api/market/tickers'){return json({items:items.map((i,k)=>({id:i.id,price:[63000,3700,1.1,150][k],change:k-1,marketState:'open',stale:false,provider:i.provider}))})}
 const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return}
 try{const data=await readFile(file);res.writeHead(200,{'content-type':({'.js':'text/javascript','.html':'text/html','.css':'text/css'}[extname(file)]||'application/octet-stream')});res.end(data)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const out=resolve('mobile-qa');await mkdir(out,{recursive:true});
const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const bundle=resolve('node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js');
await page.route('https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/**',route=>route.fulfill({path:bundle,contentType:'application/javascript'}));
const base='http://127.0.0.1:'+server.address().port;
const tap=sel=>page.locator(sel).tap();
const visible=async sel=>assert.equal(await page.locator(sel).isVisible(),true,sel+' visible');
const snap=name=>page.screenshot({path:resolve(out,name+'.png')});
try{
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#chartLoader').classList.contains('hidden'));await visible('#mobileChartToolbar');await visible('#mobileChartHeader');
 assert.equal(await page.locator('#mobileTfWheel [aria-selected=true]').innerText(),'D1');
 const dims=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,toolbar:document.querySelector('#mobileActions').scrollWidth,visible:document.querySelector('#mobileActions').clientWidth}));
 assert.equal(dims.w,393);assert.ok(dims.doc<=393);assert.ok(dims.toolbar>dims.visible);
 await snap('01-chart');
 await tap('[data-mobile-nav=watchlist]');await visible('#watchlistView');assert.equal(await page.locator('#mobileChartToolbar').isVisible(),false);
 await tap('[data-watch-filter=FAVORITES]');assert.equal(await page.locator('#watchRows .watch-row:not(.mobile-filter-hidden)').count(),2);
 await snap('02-watchlist');await tap('[data-watch-filter=ALL]');
 await tap('#watchRows [data-symbol="BIQUOTE:XAUUSD"] .watch-symbol-name');await visible('#mobileChartToolbar');
 await page.waitForFunction(()=>document.querySelector('#chartLoader').classList.contains('hidden'));
 await tap('[data-mobile-action=analysis]');await visible('#analysisHub');await snap('03-analysis-hub');
 await tap('[data-hub-action=toolstrip]');await visible('#mobileToolFavorites');
 await tap('[data-mobile-tool=all]');await visible('#drawingToolSearch');await snap('04-drawing-studio');
 assert.equal(await page.locator('.drawing-tile-star').count(),0);await visible('.drawing-grid-empty');
 // Drawing palette: bounded horizontal tab scrolling and compact touch targets.
 const paletteCDP=await page.context().newCDPSession(page);
 async function swipePalette(sel,direction){
  const b=await page.locator(sel).boundingBox(),y=b.y+Math.min(b.height/2,24),a=b.x+b.width*(direction==='left'?.82:.18),z=b.x+b.width*(direction==='left'?.18:.82);
  await paletteCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a,y}]});
  for(let i=1;i<=8;i++){await paletteCDP.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a+(z-a)*i/8,y}]});await page.waitForTimeout(24)}
  await paletteCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 const paletteSize=await page.evaluate(()=>{const p=document.querySelector('#drawingPaletteV2'),t=document.querySelector('#drawingCategoryTabs'),m=document.querySelector('.modal');return {panel:p.getBoundingClientRect().width,modal:m.clientWidth,tabs:t.clientWidth,total:t.scrollWidth,x:p.getBoundingClientRect().left}});
 assert.ok(paletteSize.panel<=paletteSize.modal+1&&paletteSize.x>=0,'drawing panel stays inside modal');
 assert.ok(paletteSize.total>paletteSize.tabs,'tab strip owns horizontal overflow');
 await swipePalette('#drawingCategoryTabs','left');await page.waitForFunction(()=>document.querySelector('#drawingCategoryTabs').scrollLeft>40);
 const tabOffset=await page.locator('#drawingCategoryTabs').evaluate(el=>el.scrollLeft);
 await swipePalette('#drawingCategoryTabs','right');await page.waitForFunction(n=>document.querySelector('#drawingCategoryTabs').scrollLeft<n-20,tabOffset);
 await tap('[data-drawing-tab=trend]');await visible('[data-draw-pick=horizontal]');
 const compact=await page.locator('[data-draw-pick=horizontal]').evaluate(el=>({tile:el.getBoundingClientRect().height,icon:el.querySelector('svg').getBoundingClientRect().width,grid:el.parentElement.getBoundingClientRect().right,panel:el.closest('#drawingPaletteV2').getBoundingClientRect().right}));
 assert.ok(compact.tile>=44&&compact.tile<=64&&compact.icon<=22&&compact.grid<=compact.panel+1,'compact tiles and icons fit inside screen');
 await swipePalette('#drawingToolList','left');await page.waitForSelector('[data-drawing-tab=fib][aria-selected=true]');await visible('[data-draw-pick=fibo]');
 await swipePalette('#drawingToolList','right');await page.waitForSelector('[data-drawing-tab=trend][aria-selected=true]');await visible('[data-draw-pick=horizontal]');
 await paletteCDP.detach();
 await page.locator('[data-draw-pick=horizontal]').scrollIntoViewIfNeeded();const target=await page.locator('[data-draw-pick=horizontal]').boundingBox();const cdp=await page.context().newCDPSession(page);const point={x:target.x+target.width/2,y:target.y+target.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.locator('#drawingFavoriteAction').waitFor({state:'visible',timeout:3000});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await visible('#drawingFavoriteAction');assert.equal(await page.locator('#drawingFavoriteAction').innerText(),'Favoritkan');await page.waitForTimeout(150);await tap('#drawingFavoriteAction');
 await tap('[data-drawing-tab=favorite]');assert.equal(await page.locator('.drawing-tile-star').count(),1);await snap('04b-favorite');
 await page.locator('[data-draw-pick=horizontal]').dispatchEvent('contextmenu');await visible('#drawingFavoriteAction');assert.equal(await page.locator('#drawingFavoriteAction').innerText(),'Hapus dari favorit');await tap('#drawingFavoriteAction');await visible('.drawing-grid-empty');
 await page.waitForTimeout(750);await page.locator('#drawingToolSearch').fill('Horizontal line');await page.locator('[data-draw-pick=horizontal]').first().tap();
 await visible('#drawingHint');const plot=await page.locator('#chartStage').boundingBox();
 await page.touchscreen.tap(plot.x+Math.floor(plot.width*.4),plot.y+Math.floor(plot.height*.45));
 await page.waitForFunction(()=>document.querySelector('#drawingOverlay [data-drawing-id]'));await visible('#drawingQuickBar');
 // Direct styling on the selected drawing must affect its rendered geometry, stay selected, and support undo.
 await visible('#drawingQuickColor');await page.locator('#drawingQuickColor').fill('#ff9900');
 await page.locator('#drawingQuickWidth').selectOption('4');
 await page.locator('#drawingQuickDash').selectOption('dashed');
 const styled=()=>page.locator('#drawingOverlay [data-drawing-id] line').first().evaluate(el=>[el.getAttribute('stroke'),el.getAttribute('stroke-width'),el.getAttribute('stroke-dasharray')]);
 assert.deepEqual(await styled(),['#ff9900','4','7 4']);await visible('#drawingQuickBar');
 await snap('05-drawing');
 // Genuine mobile taps: more vertices than the legacy fixed-count paths allowed.
 await tap('[data-mobile-tool=all]');await page.locator('#drawingToolSearch').fill('Polyline');await tap('[data-draw-pick=polyline]');
 const pbox=await page.locator('#chartStage').boundingBox();
 for(let i=0;i<7;i++)await page.touchscreen.tap(pbox.x+pbox.width*(.12+i*.09),pbox.y+pbox.height*(i%2?.42:.27));
 await visible('#drawingHintFinish');await tap('#drawingHintFinish');await visible('#drawingQuickBar');
 const poly=page.locator('#drawingOverlay [data-drawing-id]').last();
 assert.equal(await poly.locator('polyline').first().evaluate(el=>el.getAttribute('points').trim().split(/ +/).length),7);
 assert.equal(await poly.locator('[data-handle=p6]').count(),2);
 await tap('[data-drawing-action=edit]');await visible('[data-setting=price-p6]');
 await page.locator('[data-setting=price-p6]').fill(String(Number(await page.locator('[data-setting=price-p6]').inputValue())+1));assert.deepEqual(await page.locator('#drawingSettingsForm').evaluate(form=>[...form.querySelectorAll(':invalid')].map(el=>({key:el.dataset.setting,message:el.validationMessage}))),[]);await tap('#drawingSettingsForm button[type=submit]');await page.locator('#modalBackdrop').waitFor({state:'hidden'});
 await visible('#drawingQuickBar');await snap('05b-polyline');
 await tap('[data-mobile-tool=all]');await page.locator('#drawingToolSearch').fill('Fib Retracement');await tap('[data-draw-pick=fibo]');
 await page.touchscreen.tap(pbox.x+pbox.width*.2,pbox.y+pbox.height*.3);
 await page.touchscreen.tap(pbox.x+pbox.width*.55,pbox.y+pbox.height*.48);
 await visible('#drawingQuickBar');
 const fib=page.locator('#drawingOverlay [data-drawing-id]').last();
 const level=(k)=>fib.locator('text').filter({hasText:new RegExp('^'+k+' \\(')}).first().textContent();
 const zero=await level('0'),one=await level('1');
 assert.notEqual(zero.slice(1),one.slice(1));
 await tap('[data-drawing-action=edit]');await page.locator('[data-setting=reverse]').check();await page.locator('[data-setting=extendLeft]').check();assert.deepEqual(await page.locator('#drawingSettingsForm').evaluate(form=>[...form.querySelectorAll(':invalid')].map(el=>({key:el.dataset.setting,message:el.validationMessage}))),[]);await tap('#drawingSettingsForm button[type=submit]');await page.locator('#modalBackdrop').waitFor({state:'hidden'});
 assert.equal((await level('0')).slice(1),one.slice(1));assert.equal((await level('1')).slice(1),zero.slice(1));
 assert.ok(await fib.locator('line[x1="0"]').count()>0);await snap('05c-fibonacci');
 await tap('[data-mobile-action=analysis]');await tap('[data-hub-action=objects]');await visible('#objectsView');assert.ok(await page.locator('[data-object-action=edit]').count()>0);await snap('06-objects');
 await tap('[data-mobile-nav=explore]');await visible('#mobileExplorePage');await page.waitForSelector('[data-explore-save="BIQUOTE:USDJPY"]');
 await tap('[data-explore-save="BIQUOTE:USDJPY"]');assert.equal(await page.locator('[data-explore-save="BIQUOTE:USDJPY"]').innerText(),'✓');await snap('07-explore');
 await tap('[data-mobile-nav=menu]');await visible('#mobileMenuPage');await snap('08-menu');
 await tap('[data-mobile-menu-action=themeBtn]');assert.equal(await page.locator('body').getAttribute('data-theme'),'light');await snap('09-menu-light');
 await tap('[data-mobile-nav=chart]');await visible('#mobileChartToolbar');await snap('10-chart-light');
 // Desktop layout and drawing interactions share this same deterministic market fixture.
 const desktop=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const desktopErrors=[];desktop.on('pageerror',e=>desktopErrors.push(e.message));
 await desktop.route('https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/**',route=>route.fulfill({path:bundle,contentType:'application/javascript'}));
 await desktop.goto(base);
 await desktop.waitForFunction(()=>document.querySelector('#chartLoader').classList.contains('hidden'));
 const shell=await desktop.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
  return {header:box('.topbar'),left:box('.leftbar'),plot:box('.middle'),right:box('#rightbar'),footer:box('.chart-footer'),status:box('.statusbar'),favorites:box('#favoritesBar'),bodyWidth:document.documentElement.scrollWidth};
 });
 assert.ok(shell.header.h>=42&&shell.header.h<=54,'compact top header');
 assert.ok(shell.left.w>=43&&shell.left.w<=55,'left rail near TradingView width');
 assert.ok(shell.right.w>=280,'desktop watchlist starts expanded');
 assert.ok(shell.left.right<=shell.plot.x+2,'left rail precedes chart');
 assert.ok(shell.plot.right<=shell.right.x+2,'chart precedes right pane');
 assert.ok(shell.footer.bottom<shell.status.y,'range controls above status');
 assert.equal(shell.bodyWidth,1440,'no horizontal page overflow');
 assert.ok(shell.favorites.y>=shell.header.bottom&&shell.favorites.h<40,'favorites float over chart without a second header');
 await desktop.screenshot({path:resolve(out,'11-desktop-shell.png')});
 const groups=['cursor','trend','fib','patterns','projection','shapes','annotation','visual','smc','measure'];
 const expected=['pointer','trend','fibo','xabcd','long','brush','text','emoji','obZone','ruler'];
 for(let i=0;i<groups.length;i++){
  const button=desktop.locator('[data-drawing-group="'+groups[i]+'"]');
  await button.click();
  assert.equal(await button.getAttribute('aria-expanded'),'true',groups[i]+' expands');
  assert.ok(await desktop.locator('#desktopDrawingFlyout [data-draw-pick="'+expected[i]+'"]').count()>0,groups[i]+' selectable tool');
  const box=await desktop.locator('#desktopDrawingFlyout').boundingBox(),rail=await button.boundingBox();
  assert.ok(box.x>=rail.x+rail.width-1&&box.x+box.width<=1441,groups[i]+' flyout is alongside rail');
  await desktop.keyboard.press('Escape');
  assert.equal(await desktop.locator('#desktopDrawingFlyout').isVisible(),false,groups[i]+' closes');
 }
 await desktop.locator('[data-drawing-group=trend]').click();
 await desktop.locator('#desktopDrawingFlyout [data-draw-pin=trend]').click();
 assert.ok(await desktop.locator('#favoriteTools [data-quick-tool=trend]').count()>0,'favorite tool updates toolbar');
 await desktop.locator('#desktopDrawingFlyout [data-draw-pick=trend]').click();
 await desktop.waitForFunction(()=>document.querySelector('#drawingOverlay').style.pointerEvents==='auto');
 const r=await desktop.locator('#chartStage').boundingBox();
 await desktop.mouse.click(r.x+r.width*.25,r.y+r.height*.30);
 await desktop.mouse.click(r.x+r.width*.45,r.y+r.height*.45);
 await desktop.waitForFunction(()=>document.querySelectorAll('#drawingOverlay [data-drawing-id]').length>0);
 assert.ok(await desktop.locator('#drawingQuickBar').isVisible(),'drawing toolbar visible after placement');
 await desktop.screenshot({path:resolve(out,'12-desktop-trend.png')});
 await desktop.locator('[data-drawing-group=fib]').click();
 await desktop.locator('#desktopDrawingFlyout [data-draw-pick=fibo]').click();
 await desktop.mouse.click(r.x+r.width*.30,r.y+r.height*.32);
 await desktop.mouse.click(r.x+r.width*.56,r.y+r.height*.55);
 await desktop.waitForFunction(()=>document.querySelectorAll('#drawingOverlay [data-drawing-id]').length>=2);
 assert.ok(await desktop.locator('#drawingOverlay text').count()>=2,'Fibonacci levels render');
 await desktop.locator('[data-drawing-group=projection]').click();
 assert.ok(await desktop.locator('#desktopDrawingFlyout [data-draw-pick=long]').count()>0);
 await desktop.screenshot({path:resolve(out,'13-desktop-drawing-groups.png')});
 await desktop.keyboard.press('Escape');
 await desktop.locator('[data-range=ytd]').click();
 assert.match(await desktop.locator('[data-range=ytd]').getAttribute('class')||'',/active/,'YTD chart range active');
 await desktop.locator('[data-panel=pine]').click();
 assert.equal(await desktop.locator('#bottomPanel').evaluate(e=>e.classList.contains('collapsed')),false,'bottom editor expands');
 await desktop.locator('#panelCollapse').click();
 await desktop.locator('[data-right=alerts]').click();
 assert.ok(await desktop.locator('#alertsView').isVisible(),'alerts content opens on right');
 await desktop.locator('[data-right=objects]').click();
 assert.ok(await desktop.locator('#objectsView').isVisible(),'object tree opens on right');
 await desktop.locator('[data-right=watchlist]').click();
 assert.ok(await desktop.locator('#watchlistView').isVisible(),'watchlist returns on right');
 assert.deepEqual(desktopErrors,[],'no desktop JavaScript exceptions');
 console.log('Desktop Chromium QA passed: 1440x900, shell geometry, 10 categories, drawing placement, favorites, range, bottom and right panels.');
 await desktop.close();
 assert.deepEqual(errors,[]);console.log('Mobile Chromium smoke passed: 393x852, routes, D1, scroll overflow, filters, analysis, touch drawing, object tree, catalog addition, theme. Market fixtures only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
