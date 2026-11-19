import {favoriteWheel,supportsTimeframe,nativeQuote,tfLabel,CURRENCIES,readRate,makeDisplay} from './mobile-preferences.js';
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
export function mountMobileUI({state,chart,ui,marketInfo,updateSymbol,updateTF,openModal,closeModal,setRight,setPanel,toast,renderDetails,searchSymbols}){
 let pairWheel,tfWheel,display=null,quote=null,quoteRequest=0,quoteAbort=null,lastSymbol='',installed=false,queued=false,previousMobile=false,fxCache=new Map();
 const prefs=()=>ui.exportPrefs();
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
  pairWheel.render();tfWheel.render();
 }
 function schedule(){if(!queued){queued=true;queueMicrotask(()=>{queued=false;render()})}}
 function nav(name){document.querySelectorAll('[data-mobile-nav]').forEach(b=>{const active=b.dataset.mobileNav===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
 function showChart(save=true){
  $('rightbar').classList.remove('expanded');$('rightbar').classList.add('shrunk');$('bottomPanel').classList.add('collapsed');
  if(save){ui.setLayout('sidebarCollapsed',true);ui.setLayout('panelCollapsed',true)}
  nav('chart');chart.resize();
 }
 function showSidebar(name){$('bottomPanel').classList.add('collapsed');setRight(name,true);nav(name==='alerts'?'alerts':'watchlist')}
 function listModal(title,items){openModal(title,'<div class="modal-list mobile-menu-list">'+items.map((it,i)=>'<button type="button" class="modal-symbol" data-mobile-menu="'+i+'"><strong>'+esc(it[0])+'</strong><span class="right-tag">›</span></button>').join('')+'</div>',root=>{root.onclick=e=>{const b=e.target.closest('[data-mobile-menu]');if(!b)return;const item=items[Number(b.dataset.mobileMenu)];if(item){closeModal();item[1]()}}})}
 function drawings(){const tools=[...document.querySelectorAll('.leftbar .tool[data-tool]')];listModal('Drawing tools',[
 ...tools.map(b=>[b.title,()=>b.click()]),
 ['Magnet',()=>click('magnetBtn')],['Sembunyikan / tampilkan drawing',()=>click('hideDrawingsBtn')],['Hapus semua drawing',()=>click('clearDrawingsBtn')]
 ])}
 function more(){listModal('Opsi chart',[
 ['Jenis chart',()=>click('chartTypeBtn')],['Chart settings',()=>click('chartSettingsBtn')],['Kelola favorit',()=>ui.favoritesModal()],['Bandingkan simbol',()=>click('compareBtn')],['Alert',()=>click('alertBtn')],['Bar replay',()=>click('replayBtn')],['Object tree',()=>showSidebar('objects')],
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
  $('mobileActions').addEventListener('click',e=>{const b=e.target.closest('[data-mobile-action]');if(!b)return;const id=b.dataset.mobileAction;if(id==='drawing')drawings();else if(id==='more')more();else if(id==='focus'){const active=$('app').classList.toggle('mobile-focus');b.setAttribute('aria-pressed',String(active));chart.resize()}else click(id)});
  document.querySelector('.mobile-nav').addEventListener('click',e=>{const b=e.target.closest('[data-mobile-nav]');if(!b)return;const n=b.dataset.mobileNav;if(n==='chart')showChart();else if(n==='watchlist'||n==='alerts'){if($('rightbar').classList.contains('expanded')&&state.rightView===n)showChart();else showSidebar(n)}else if(n==='explore')click('symbolBtn');else more()});
  window.addEventListener('tw:ui-render',schedule);
  const mq=window.matchMedia('(max-width: 760px)');previousMobile=mq.matches;
  mq.addEventListener?.('change',()=>{if(mq.matches&&!previousMobile){showChart(false);render()}else if(!mq.matches){$('app').classList.remove('mobile-focus');if(display)setDisplay(null)}previousMobile=mq.matches});
  schedule();
 }
 return {install,render,showChart,currencyLabel};
}
