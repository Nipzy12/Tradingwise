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
 assert.equal(await page.locator('.drawing-tile-star').count(),0);
 await tap('[data-draw-tab="Peralatan Tren"]');await visible('[data-draw-pick=horizontal]');
 const tile=page.locator('[data-draw-pick=horizontal]'),b=await tile.boundingBox(),cdp=await page.context().newCDPSession(page),point={x:b.x+b.width/2,y:b.y+b.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.waitForTimeout(700);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await visible('#drawingHoldMenu');assert.equal(await page.locator('[data-hold-toggle]').innerText(),'Favoritkan');await tap('[data-hold-toggle]');assert.equal(await tile.locator('.drawing-tile-star').count(),1);
 await tap('[data-draw-tab="Favorit"]');await visible('[data-draw-pick=horizontal]');await snap('04b-favorites');
 const pinBox=await page.locator('[data-draw-pick=horizontal]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pinBox.x+pinBox.width/2,y:pinBox.y+pinBox.height/2}]});await page.waitForTimeout(700);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await visible('#drawingHoldMenu');assert.equal(await page.locator('[data-hold-toggle]').innerText(),'Hapus dari favorit');await tap('[data-hold-toggle]');assert.equal(await page.locator('.drawing-tile-star').count(),0);
 await page.locator('#drawingToolSearch').fill('Horizontal line');await page.waitForTimeout(850);await page.locator('[data-draw-pick=horizontal]').first().tap();
 await visible('#drawingHint');const plot=await page.locator('#chartStage').boundingBox();
 await page.touchscreen.tap(plot.x+Math.floor(plot.width*.4),plot.y+Math.floor(plot.height*.45));
 await page.waitForFunction(()=>document.querySelector('#drawingOverlay [data-drawing-id]'));await visible('#drawingQuickBar');await snap('05-drawing');
 await tap('[data-mobile-action=analysis]');await tap('[data-hub-action=objects]');await visible('#objectsView');assert.ok(await page.locator('[data-object-action=edit]').count()>0);await snap('06-objects');
 await tap('[data-mobile-nav=explore]');await visible('#mobileExplorePage');await page.waitForSelector('[data-explore-save="BIQUOTE:USDJPY"]');
 await tap('[data-explore-save="BIQUOTE:USDJPY"]');assert.equal(await page.locator('[data-explore-save="BIQUOTE:USDJPY"]').innerText(),'✓');await snap('07-explore');
 await tap('[data-mobile-nav=menu]');await visible('#mobileMenuPage');await snap('08-menu');
 await tap('[data-mobile-menu-action=themeBtn]');assert.equal(await page.locator('body').getAttribute('data-theme'),'light');await snap('09-menu-light');
 await tap('[data-mobile-nav=chart]');await visible('#mobileChartToolbar');await snap('10-chart-light');
 assert.deepEqual(errors,[]);console.log('Mobile Chromium smoke passed: 393x852, routes, D1, scroll overflow, filters, analysis, touch drawing, object tree, catalog addition, theme. Market fixtures only.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
