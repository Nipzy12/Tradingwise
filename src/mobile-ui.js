import {favoriteWheel,supportsTimeframe,nativeQuote,tfLabel,CURRENCIES,readRate,makeDisplay} from './mobile-preferences.js';
import {TOOL_CATALOG} from './drawing-model.js';
import {marketFilter,mergeCatalogPage,shellRoute} from './mobile-shell-model.js';
const $=id=>document.getElementById(id);
export const isMobileLayout=()=>window.matchMedia('(max-width: 760px)').matches;
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const click=id=>$(id)?.click();
const rowHeight=24;
function wheel(root,{items,selected,label,choose,open}){
 let signature='',values=[],current='',timer;
 function settle(){
  clearTimeout(timer);
  const index=Math.max(0,Math.min(values.length-1,Math.round(root.scrollTop/rowHeight)));
  const value=values[index]; if(value&&value!==current)choose(value);
 }
 root.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(settle,160)},{passive:true});
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-wheel-value]');if(!button)return;
  clearTimeout(timer);const value=button.dataset.wheelValue;
  if(value===current)open();else choose(value);
 });
 root.addEventListener('keydown',e=>{
  if(e.target!==root)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();open();return}
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const i=values.indexOf(current)+(e.key==='ArrowUp'?-1:1);if(values[i])choose(values[i])}
 });
 return {render(){
  const next=items(),active=selected(),names=next.map(label);
  const key=JSON.stringify([next,active,names]);
  if(key===signature)return;
  signature=key; values=next;current=active;clearTimeout(timer);
  root.innerHTML=values.map((v,i)=>'<button type="button" role="option" tabindex="-1" data-wheel-value="'+esc(v)+'" aria-selected="'+(v===current)+'" class="'+(v===current?'selected':'')+'" title="'+esc(names[i])+'">'+esc(names[i])+'</button>').join('');
  root.scrollTop=Math.max(0,values.indexOf(current))*rowHeight;
 }};
}
export function mountMobileUI({state,chart,ui,drawingLayer,marketInfo,updateSymbol,updateTF,openModal,closeModal,setRight,setPanel,toast,renderDetails,renderWatchlist,refreshTickers,persist,searchSymbols,CATALOG,toggleIndicator}){
 let pairWheel,tfWheel,display=null,quote=null,quoteRequest=0,quoteAbort=null,lastSymbol='',installed=false,queued=false,previousMobile=false,fxCache=new Map();
 const prefs=()=>ui.exportPrefs();
 let page='chart',watchFilter='ALL',exploreProvider='BIQUOTE',exploreItems=[],exploreOffset=0,exploreTotal=0,exploreController=null,exploreSeq=0,exploreTimer=null,exploreLoading=false;
 let favoritesOpen=false;
 const svg=id=>'<svg aria-hidden="true"><use href="#i-'+esc(id)+'"/></svg>';
 function updateWatchCount(){
  const rows=$('watchRows');if(!rows)return;let count=0;
  rows.querySelectorAll('[data-symbol]').forEach(row=>{const yes=marketFilter(watchFilter,row.dataset.provider,row.dataset.favorite==='true');row.classList.toggle('mobile-filter-hidden',!yes);if(yes)count++});
  $('mobileWatchCount').textContent=count+' / '+state.watchlist.length+' simbol';
 }
 function renderToolStrip(){
  const bar=$('mobileToolFavorites'),ids=prefs().favorites.tools.filter(id=>TOOL_CATALOG[id]);
  bar.classList.toggle('hidden',!favoritesOpen||page!=='chart');
  const mark='<button type="button" data-mobile-tool="pointer" title="Kursor" aria-label="Kursor">'+svg('pointer')+'</button>'+ids.map(id=>'<button type="button" data-mobile-tool="'+esc(id)+'" title="'+esc(TOOL_CATALOG[id].label)+'" aria-label="'+esc(TOOL_CATALOG[id].label)+'">'+svg(TOOL_CATALOG[id].icon.replace(/^i-/,''))+'</button>').join('')+'<button type="button" data-mobile-tool="all" title="Semua tool" aria-label="Semua tool">'+svg('grid')+'</button>';
  if(bar.dataset.markup!==mark){bar.dataset.markup=mark;bar.innerHTML=mark}
  bar.querySelectorAll('[data-mobile-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.mobileTool===drawingLayer.tool);b.setAttribute('aria-pressed',String(b.dataset.mobileTool===drawingLayer.tool))});
 }
 function refreshMenu(){const el=$('mobileThemeLabel');if(el)el.textContent=state.theme==='light'?'Terang':'Gelap'}
 function fillExplore(){
  const list=$('mobileExploreResults'),status=$('mobileExploreStatus');list.innerHTML=exploreItems.map(m=>'<div class="mobile-explore-row"><button type="button" data-explore-open="'+esc(m.id)+'"><span class="mobile-explore-icon">'+esc(m.icon||marketInfo(m.id).icon||'•')+'</span><span class="mobile-explore-symbol"><strong>'+esc(m.symbol||m.id)+'</strong><small>'+esc(m.name||m.symbol)+' · '+esc(m.provider)+'</small></span><span class="mobile-provider-label">'+esc(m.provider)+'</span></button><button type="button" data-explore-save="'+esc(m.id)+'" class="mobile-watch-add'+(state.watchlist.includes(m.id)?' added':'')+'" aria-label="'+(state.watchlist.includes(m.id)?'Sudah di daftar pantau':'Tambah ke daftar pantau')+'">'+(state.watchlist.includes(m.id)?'✓':'+')+'</button></div>').join('');
  $('mobileExploreMore').classList.toggle('hidden',exploreLoading||exploreOffset>=exploreTotal||exploreProvider==='FAVORITES');
  if(!exploreItems.length&&!exploreLoading&&!status.textContent)status.textContent='Tidak ada simbol.';
 }
 async function loadExplore(append=false){
  if(page!=='explore')return;const seq=++exploreSeq;exploreController?.abort();exploreController=new AbortController();exploreLoading=true;
  if(!append){exploreItems=[];exploreOffset=0;exploreTotal=0}
  const status=$('mobileExploreStatus');status.textContent='Memuat katalog…';fillExplore();
  try{
   const q=$('mobileExploreSearch').value.trim(),provider=exploreProvider;
   const result=provider==='FAVORITES'?ui.favoriteCatalog(q):await searchSymbols({q,provider,offset:exploreOffset,limit:50,signal:exploreController.signal});
   if(seq!==exploreSeq||page!=='explore')return;
   const items=Array.isArray(result.items)?result.items:[];exploreItems=mergeCatalogPage(exploreItems,items);exploreOffset+=items.length;exploreTotal=Number(result.total)||exploreOffset;
   if(!items.length)exploreTotal=exploreOffset;
   const errors=Object.entries(result.errors||{}).map(([k,v])=>k+': '+v).join(' · ');
   status.textContent=(exploreItems.length?exploreItems.length+' / '+exploreTotal+' simbol':'Tidak ada hasil')+(errors?' · '+errors:'');
  }catch(e){if(seq!==exploreSeq||page!=='explore')return;status.textContent='Katalog tidak tersedia · '+e.message}
  finally{if(seq===exploreSeq){exploreLoading=false;fillExplore()}}
 }

 const currencyLabel=()=>display?'≈ '+display.target:quote||nativeQuote(marketInfo(state.symbol),state.symbol)||'QUOTE';
 function setDisplay(next){
  display=next;chart.setPriceDisplay(next);$('mobileCurrencyCode').textContent=currencyLabel();$('priceCurrency').textContent=currencyLabel();
  const rateNote=$('mobileRateNote');rateNote.hidden=!next;
  if(next){rateNote.textContent='≈ '+next.target+' · kurs referensi';rateNote.title='Coinbase • 1 '+next.base+' = '+next.rate+' '+next.target+' • '+new Date(next.updatedAt).toLocaleString()+'. OHLC/drawing/backtest asli tidak diubah.'}
  if(!state.loading)renderDetails();
 }
 function render(){
  if(!installed||!isMobileLayout())return;
  const info=marketInfo(state.symbol),base=nativeQuote(info,state.symbol);
  if(state.symbol!==lastSymbol||base!==quote){
   lastSymbol=state.symbol;quote=base;quoteRequest++;quoteAbort?.abort();
   if(display)setDisplay(null);
  }
  $('mobileHeaderName').textContent=info.symbol||state.symbol.split(':').at(-1);
  $('mobileSymbolIcon').textContent=info.icon||'•';
  $('mobileSymbolIcon').classList.toggle('crypto',info.provider==='BINANCE');
  const badge=$('mobileMarketBadge'),closed=['closed','halted'].includes(state.marketState);
  const status=state.source==='error'?'OFFLINE':state.source==='loading'?'Loading':closed?'Closed':state.wsStatus==='connected'?'Live':state.wsStatus==='reconnecting'?'Reconnect':state.source==='rest'?'OHLC':'Offline';
  badge.textContent=status;badge.classList.toggle('live',status==='Live');badge.classList.toggle('error',status==='OFFLINE');
  const pinned=ui.hasFavorite('symbols',state.symbol);
  $('mobileFavorite').textContent=pinned?'★':'☆';$('mobileFavorite').setAttribute('aria-pressed',String(pinned));$('mobileFavorite').classList.toggle('is-favorite',pinned);
  $('mobileIndicatorCount').textContent=String(state.enabled.length+state.custom.length);
  $('mobileCurrencyCode').textContent=currencyLabel();$('mobileCurrency').title=display?'Konversi tampilan berdasarkan kurs referensi, bukan harga historis yang dikonversi':'Mata uang quote dari instrumen';
  $('mobileCurrency').disabled=!quote;
  $('mobileLog').setAttribute('aria-pressed',String(prefs().settings.priceScale==='logarithmic'));
  pairWheel.render();tfWheel.render();renderToolStrip();refreshMenu();
 }
 function schedule(){if(!queued){queued=true;queueMicrotask(()=>{queued=false;render()})}}
 function nav(name){document.querySelectorAll('[data-mobile-nav]').forEach(b=>{const active=b.dataset.mobileNav===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
 function changePage(name,save=true){
  const next=shellRoute(name);if(page==='explore'&&name!=='explore'){exploreSeq++;exploreController?.abort();clearTimeout(exploreTimer)}
  page=next.page;$('app').dataset.mobilePage=page;
  $('mobileExplorePage').classList.toggle('hidden',page!=='explore');$('mobileMenuPage').classList.toggle('hidden',page!=='menu');
  $('app').classList.remove('mobile-focus');$('mobileChartToolbar').querySelector('[data-mobile-action="focus"]')?.setAttribute('aria-pressed','false');
  $('bottomPanel').classList.add('collapsed');
  if(next.sidebar){setRight(next.sidebar,true);$('rightTitle').textContent=next.sidebar==='watchlist'?'Daftar Pantau':next.sidebar==='objects'?'Object tree':'Alert';updateWatchCount()}
  else{$('rightbar').classList.remove('expanded');$('rightbar').classList.add('shrunk');if(save){ui.setLayout('sidebarCollapsed',true);ui.setLayout('panelCollapsed',true)}}
  nav(next.tab);renderToolStrip();refreshMenu();if(page==='explore')void loadExplore();if(page==='chart'){requestAnimationFrame(()=>{chart.resize();pairWheel.render();tfWheel.render()})}
 }
 function showChart(save=true){changePage('chart',save)}
 function showSidebar(name){changePage(name)}
 function menuAction(id){
  if(['watchlist','alerts','objects'].includes(id)){showSidebar(id);return}
  if(id==='favorites'){ui.favoritesModal();return}
  if(['pine','tester','trade'].includes(id)){showChart();setPanel(id);return}
  if(id==='import'){$('workspaceFile').click();return}
  click(id);refreshMenu()
 }
 function analysis(){
  const shortcuts=[['indicatorsBtn','Indikator','activity'],['chartTypeBtn','Jenis chart','candles'],['compareBtn','Bandingkan','plus'],['alertBtn','Buat alert','bell'],['replayBtn','Bar replay','rewind'],['objects','Object tree','grid'],['pine','Pine Editor','activity'],['tester','Strategy Tester','chart'],['trade','Paper trading','candles'],['chartSettingsBtn','Pengaturan','settings']];
  const icons='<div class="mobile-analysis-grid">'+shortcuts.map(([id,label,ic])=>'<button type="button" data-hub-action="'+id+'">'+svg(ic)+'<span>'+label+'</span></button>').join('')+'</div>';
  const favorites=prefs().favorites.indicators.map(id=>CATALOG.find(c=>c.id===id)).filter(Boolean);
  openModal('Pusat analisis','<div id="analysisHub">'+icons+'<div class="mobile-hub-heading">Indikator favorit</div>'+(favorites.length?favorites.map(c=>'<button type="button" class="mobile-hub-indicator" data-hub-indicator="'+esc(c.id)+'"><span>'+esc(c.name)+'</span><strong>'+(state.enabled.includes(c.id)?'Aktif ✓':'+ Tambah')+'</strong></button>').join(''):'<p class="settings-note">Beri bintang indikator untuk akses cepat.</p>')+'<div class="mobile-hub-heading">Drawing</div><button type="button" class="mobile-hub-indicator" data-hub-action="drawing"><span>Drawing Studio</span><strong>›</strong></button><button type="button" class="mobile-hub-indicator" data-hub-action="toolstrip"><span>Toolbar drawing favorit</span><strong>'+(favoritesOpen?'Aktif':'Tampilkan')+'</strong></button></div>',root=>{
   root.onclick=e=>{const indicator=e.target.closest('[data-hub-indicator]');if(indicator){toggleIndicator(indicator.dataset.hubIndicator);analysis();return}const b=e.target.closest('[data-hub-action]');if(!b)return;const id=b.dataset.hubAction;closeModal();if(id==='drawing')drawings();else if(id==='toolstrip'){favoritesOpen=!favoritesOpen;renderToolStrip()}else menuAction(id)};
  })
 }
 function listModal(title,items){openModal(title,'<div class="modal-list mobile-menu-list">'+items.map((it,i)=>'<button type="button" class="modal-symbol" data-mobile-menu="'+i+'"><strong>'+esc(it[0])+'</strong><span class="right-tag">›</span></button>').join('')+'</div>',root=>{root.onclick=e=>{const b=e.target.closest('[data-mobile-menu]');if(!b)return;const item=items[Number(b.dataset.mobileMenu)];if(item){closeModal();item[1]()}}})}
 function drawings(){showChart();ui.drawingToolsModal()}

 function more(){listModal('Opsi chart',[
 ['Drawing Studio',drawings],['Jenis chart',()=>click('chartTypeBtn')],['Chart settings',()=>click('chartSettingsBtn')],['Kelola favorit',()=>ui.favoritesModal()],['Bandingkan simbol',()=>click('compareBtn')],['Alert',()=>click('alertBtn')],['Bar replay',()=>click('replayBtn')],['Object tree',()=>showSidebar('objects')],
 ['Pine Editor',()=>{showChart();setPanel('pine')}],['Strategy Tester',()=>{showChart();setPanel('tester')}],['Trading Panel (paper)',()=>{showChart();setPanel('trade')}],['Ganti tema',()=>click('themeBtn')],['Simpan workspace',()=>click('saveBtn')],['Tentang Tradingwise',()=>click('infoBtn')]
 ])}
 async function chooseCurrency(target){
  const base=quote;if(!base)return;
  const request=++quoteRequest;quoteAbort?.abort();
  if(target===base){setDisplay(null);return}
  const key=base+':'+target;let data=fxCache.get(key);
  try{
   if(!data||Date.now()-data.updatedAt>300000){
    const controller=new AbortController();quoteAbort=controller;const timeout=setTimeout(()=>controller.abort(),12000);
    try{
     const response=await fetch('https://api.coinbase.com/v2/exchange-rates?currency='+encodeURIComponent(base),{signal:controller.signal,cache:'no-store',headers:{accept:'application/json'}});
     if(!response.ok)throw Error('HTTP '+response.status);
     data=makeDisplay(base,target,readRate(await response.json(),base,target));fxCache.set(key,data);
    }finally{clearTimeout(timeout)}
   }
   if(request!==quoteRequest||base!==quote)return;
   setDisplay(data);toast('Skala tampilan: '+target+' (kurs referensi Coinbase)','success');
  }catch(e){if(request===quoteRequest)toast('Kurs '+base+' → '+target+' tidak tersedia. Skala tidak diubah.','error')}
 }
 function currencyModal(){
  if(!quote)return;
  const items=[[quote+' · Mata uang simbol',()=>chooseCurrency(quote)],...CURRENCIES.filter(c=>c!==quote).map(c=>[c,()=>chooseCurrency(c)])];
  listModal('Mata uang skala harga',items);
  const note=document.createElement('p');note.className='settings-note';note.textContent='Konversi tampilan memakai kurs referensi terbaru saat dipilih, bukan konversi historis per candle. Harga sumber, alert, indikator, dan backtest tidak diubah.';$('modalBody').prepend(note)
 }
 function install(){
  if(installed)return;installed=true;
  pairWheel=wheel($('mobilePairWheel'),{items:()=>favoriteWheel(prefs().favorites.symbols,state.symbol),selected:()=>state.symbol,label:id=>marketInfo(id).symbol||id.split(':').at(-1),choose:id=>{showChart();updateSymbol(id)},open:()=>click('symbolBtn')});
  tfWheel=wheel($('mobileTfWheel'),{items:()=>favoriteWheel(prefs().favorites.timeframes,state.tf,tf=>supportsTimeframe(state.symbol,tf)),selected:()=>state.tf,label:tfLabel,choose:tf=>{if(supportsTimeframe(state.symbol,tf)){showChart();updateTF(tf)}},open:()=>ui.timeframesModal()});
  $('mobileHeaderSymbol').onclick=()=>click('symbolBtn');
  $('mobileFavorite').onclick=()=>ui.toggleFavorite('symbols',state.symbol);
  $('mobileCurrency').onclick=currencyModal;
  $('mobileLegendToggle').onclick=()=>{const open=$('chartWindow').classList.toggle('mobile-info-open');$('mobileLegendToggle').setAttribute('aria-expanded',String(open))};
  $('mobileAuto').onclick=()=>{chart.autoScale();chart.fit()};
  $('mobileLog').onclick=()=>{const current=prefs().settings.priceScale;ui.setChartPreference('priceScale',current==='logarithmic'?'normal':'logarithmic')};
  $('mobileActions').addEventListener('click',e=>{const b=e.target.closest('[data-mobile-action]');if(!b)return;const id=b.dataset.mobileAction;if(id==='drawing')drawings();else if(id==='analysis')analysis();else if(id==='more')more();else if(id==='focus'){const active=$('app').classList.toggle('mobile-focus');b.setAttribute('aria-pressed',String(active));chart.resize()}else click(id)});
  document.querySelector('.mobile-nav').addEventListener('click',e=>{const b=e.target.closest('[data-mobile-nav]');if(b)changePage(b.dataset.mobileNav)});
  $('mobilePanelBack').onclick=()=>showChart();
  $('mobileWatchFilters').onclick=e=>{const b=e.target.closest('[data-watch-filter]');if(!b)return;watchFilter=b.dataset.watchFilter;for(const el of $('mobileWatchFilters').querySelectorAll('button'))el.setAttribute('aria-pressed',String(el===b));updateWatchCount()};
  $('mobileExploreFilters').onclick=e=>{const b=e.target.closest('[data-explore-provider]');if(!b)return;exploreProvider=b.dataset.exploreProvider;for(const el of $('mobileExploreFilters').querySelectorAll('button'))el.setAttribute('aria-pressed',String(el===b));void loadExplore()};
  $('mobileExploreSearch').oninput=()=>{clearTimeout(exploreTimer);exploreSeq++;exploreController?.abort();exploreTimer=setTimeout(()=>loadExplore(),260)};
  $('mobileExploreRefresh').onclick=()=>loadExplore();$('mobileExploreMore').onclick=()=>{if(!exploreLoading)void loadExplore(true)};
  $('mobileExploreResults').onclick=e=>{const save=e.target.closest('[data-explore-save]'),open=e.target.closest('[data-explore-open]');if(save){const id=save.dataset.exploreSave;if(state.watchlist.includes(id)){toast('Simbol sudah di daftar pantau');return}if(state.watchlist.length>=60){toast('Maksimal 60 simbol','error');return}state.watchlist.push(id);persist();renderWatchlist();void refreshTickers();fillExplore();toast('Simbol ditambahkan','success')}else if(open){updateSymbol(open.dataset.exploreOpen);showChart()}};
  $('mobileMenuPage').onclick=e=>{const b=e.target.closest('[data-mobile-menu-action]');if(b)menuAction(b.dataset.mobileMenuAction)};
  $('mobileToolFavorites').onclick=e=>{const b=e.target.closest('[data-mobile-tool]');if(!b)return;if(b.dataset.mobileTool==='all')drawings();else drawingLayer.setTool(b.dataset.mobileTool);renderToolStrip()};
  window.addEventListener('tw:draw-tool',renderToolStrip);
  window.addEventListener('tw:ui-render',schedule);
  const mq=window.matchMedia('(max-width: 760px)');previousMobile=mq.matches;
  mq.addEventListener?.('change',()=>{if(mq.matches&&!previousMobile){showChart(false);render()}else if(!mq.matches){showChart(false);if(display)setDisplay(null)}previousMobile=mq.matches});
  schedule();
 }
 return {install,render,showChart,currencyLabel,updateWatchCount};
}
