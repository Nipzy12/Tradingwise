// Tradingwise v0.8: interactive favorites, layout and chart preferences.
// Private OAuth credentials are not part of this module.
import {
 readUiPreferences, writeUiPreferences, normalizeUiPreferences,
 toggleFavorite, hasFavorite, orderWatchlist, TIMEFRAMES, DEFAULT_UI_PREFS
} from './ui-preferences.js';
import {TOOL_CATALOG,isVariablePath} from './drawing-model.js';
import {DESKTOP_GROUPS,desktopGroupItems} from './drawing-desktop-model.js';
import {mountDesktopDrawingToolbar} from './drawing-desktop.js';
import {mountDrawingPalette} from './drawing-palette.js';

const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const labelTf=t=>({ '1h':'1H','2h':'2H','4h':'4H','1d':'D','1w':'W' })[t]||t;
const TOOLS=Object.fromEntries(Object.values(TOOL_CATALOG).filter(t=>t.points>0).map(t=>[t.id,[t.label,t.icon]]));
const icon=id=>'<svg><use href="#'+esc(id)+'"/></svg>';
const fill=(node,markup)=>{if(node.dataset.rendered!==markup){node.dataset.rendered=markup;node.innerHTML=markup}};

export function mountWorkspaceUI({state,chart,drawingLayer,marketInfo,CATALOG,toast,persist,renderWatchlist,updateSymbol,updateTF,toggleIndicator,openModal,closeModal}){
 let prefs=readUiPreferences(localStorage);
 const save=()=>{prefs=writeUiPreferences(localStorage,prefs)};
 const current=(kind,id)=>hasFavorite(prefs,kind,id);
 function apply(){
  chart.setPreferences(prefs.settings);
  el('chartLegend')?.classList.toggle('hidden',!prefs.settings.legend);
  document.querySelector('.chart-watermark')?.classList.toggle('hidden',!prefs.settings.watermark);
  el('favoritesBar')?.classList.toggle('hidden',!prefs.showFavoritesBar);
  render();
 }
 function render(){
  const button=el('symbolFavoriteBtn');
  if(button){const favorite=current('symbols',state.symbol);
   button.classList.toggle('is-favorite',favorite);
   button.setAttribute('aria-pressed',String(favorite));
   button.title=favorite?'Hapus simbol dari Favorit':'Simpan simbol ke Favorit';
  }
  document.querySelectorAll('#tfGroup [data-tf]').forEach(b=>{
   b.hidden=!current('timeframes',b.dataset.tf)&&b.dataset.tf!==state.tf;
  });
  const root=el('favoritesBar');if(!root)return;
  fill(el('favoriteSymbols'),prefs.favorites.symbols.map(id=>{
   const info=marketInfo(id);return '<button class="favorite-chip'+(id===state.symbol?' active':'')+'" data-quick-symbol="'+esc(id)+'" title="'+esc(info.name||id)+'">'+esc(info.symbol||id)+'</button>';
  }).join('')||'<span class="favorite-bar-caption">Klik ☆ untuk pin simbol</span>');
  fill(el('favoriteTools'),prefs.favorites.tools.map(id=>{
   const name=TOOLS[id]?.[0]||id;return '<button class="favorite-chip favorite-tool-chip'+(drawingLayer.tool===id?' active':'')+'" data-quick-tool="'+esc(id)+'" title="'+esc(name)+'">'+icon(TOOLS[id]?.[1]||'i-pointer')+'</button>';
  }).join('')||'<span class="favorite-bar-caption">Pin tool dari toolbar</span>');
  fill(el('favoriteIndicators'),prefs.favorites.indicators.map(id=>{
   const item=CATALOG.find(x=>x.id===id);return '<button class="favorite-chip'+(state.enabled.includes(id)?' active':'')+'" data-quick-indicator="'+esc(id)+'" title="'+esc(item?.name||id)+'">'+esc(id==='smc-entry-pro-v5'?'SMC':id.toUpperCase())+'</button>';
  }).join('')||'<span class="favorite-bar-caption">Pin indikator dari menu</span>');
  window.dispatchEvent(new Event('tw:ui-render'));
 }
 function favorite(kind,value){
  try{prefs=toggleFavorite(prefs,kind,value);save();render();if(kind==='symbols')renderWatchlist();toast((current(kind,value)?'Disimpan':'Dihapus')+' dari favorit');}
  catch(e){toast(e.message,'error')}
 }
 function order(ids,marketCache={}){
  const changes=Object.fromEntries(ids.map(x=>[x,Number.isFinite(marketCache[x]?.change)?marketCache[x].change:NaN]));
  return orderWatchlist(ids,prefs.watchlistSort,prefs.favorites.symbols,changes);
 }
 function favoriteCatalog(q=''){
  const query=q.toLowerCase().trim();
  const items=prefs.favorites.symbols.map(id=>marketInfo(id)).filter(x=>(x.symbol+' '+x.name+' '+x.provider).toLowerCase().includes(query));
  return {items,total:items.length,counts:{},errors:{}};
 }
 function drawingToolsModal(){
  if(window.matchMedia('(max-width:760px)').matches){mountDrawingPalette({openModal,closeModal,layer:drawingLayer,chart,toast,render,getPrefs:()=>prefs,onFavorite:id=>favorite('tools',id),setShowFavorites:value=>{prefs.showDrawingFavorites=Boolean(value);save();render()}});return}
  openModal('Drawing Studio','<div class="drawing-palette"><input type="search" id="drawingToolSearch" placeholder="Cari tool, mis. trend, FVG, Fibonacci..." aria-label="Cari drawing tools"><div class="drawing-mode-controls"><label>Magnet <select id="drawingMagnetMode"><option value="off">Off</option><option value="weak">Weak</option><option value="strong">Strong</option></select></label><button type="button" id="drawingKeepToggle">Keep drawing</button><button type="button" id="drawingLockToggle">Lock all</button><button type="button" id="drawingHideToggle">Hide all</button></div><div id="drawingToolList"></div><p class="settings-note">Pilih tool, ketuk titik atau drag pada chart. Tool favorit tersedia di toolbar. Pilih objek untuk menggeser atau mengubah propertinya.</p></div>',root=>{
   const search=el('drawingToolSearch'),list=el('drawingToolList'),mag=el('drawingMagnetMode');mag.value=drawingLayer.magnetMode;
   function modeControls(){for(const [id,active] of [['drawingKeepToggle',drawingLayer.keepDrawing],['drawingLockToggle',drawingLayer.lockAll],['drawingHideToggle',drawingLayer.hidden]]){const btn=el(id);btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))}}
   function paint(){
    const query=search.value.toLowerCase().trim(),pins=prefs.favorites.tools;
    const matches=t=>(t.label+' '+t.id+' '+t.group).toLowerCase().includes(query);
    const toolRow=t=>'<div class="drawing-tool-row"><button type="button" data-draw-pick="'+esc(t.id)+'" class="'+(drawingLayer.tool===t.id?'active':'')+'">'+icon(t.icon)+'<span>'+esc(t.label)+'</span><small>'+(t.points===0?'Mode':t.id==='brush'||t.id==='highlighter'?'Drag':isVariablePath(t.id)?'Multi titik':t.points+' titik')+'</small></button>'+(t.points>0?'<button type="button" class="drawing-pin'+(current('tools',t.id)?' is-favorite':'')+'" data-draw-pin="'+esc(t.id)+'" aria-label="Favorit '+esc(t.label)+'">'+(current('tools',t.id)?'★':'☆')+'</button>':'')+'</div>';
    const groups=[['Favorit',pins.map(id=>TOOL_CATALOG[id]).filter(Boolean)],...DESKTOP_GROUPS.map(group=>[group.label,desktopGroupItems(group.id)])];
    list.innerHTML=groups.map(([label,items])=>{const visible=items.filter(matches);return visible.length?'<section class="drawing-category"><h3>'+esc(label)+'</h3>'+visible.map(toolRow).join('')+'</section>':''}).join('')||'<div class="side-info">Tool tidak ditemukan.</div>';
   }
   search.oninput=paint;
   list.onclick=e=>{const pin=e.target.closest('[data-draw-pin]'),pick=e.target.closest('[data-draw-pick]');if(pin){favorite('tools',pin.dataset.drawPin);paint()}else if(pick){closeModal();drawingLayer.setTool(pick.dataset.drawPick);render()}};
   mag.onchange=()=>drawingLayer.setMagnet(mag.value);
   el('drawingKeepToggle').onclick=()=>{drawingLayer.keepDrawing=!drawingLayer.keepDrawing;drawingLayer.syncControls();modeControls()};
   el('drawingLockToggle').onclick=()=>{drawingLayer.lockAll=!drawingLayer.lockAll;drawingLayer.syncControls();drawingLayer.render();modeControls()};
   el('drawingHideToggle').onclick=()=>{drawingLayer.hidden=!drawingLayer.hidden;drawingLayer.syncControls();drawingLayer.render();modeControls()};
   modeControls();paint();
  });
 }
 function timeframesModal(){
  const html='<p class="settings-note">Klik interval untuk memilih. Klik bintang untuk menampilkan atau menyembunyikannya di toolbar.</p><div class="modal-list">'+TIMEFRAMES.map(tf=>{
   const pinned=current('timeframes',tf);
   return '<div class="market-result"><button class="modal-symbol" data-timeframe-select="'+tf+'"><span><strong>'+labelTf(tf)+'</strong><small>Timeframe</small></span><span class="right-tag">'+(state.tf===tf?'Aktif':'Pilih')+'</span></button><button class="favorite-toggle'+(pinned?' is-favorite':'')+'" data-timeframe-pin="'+tf+'" aria-label="'+(pinned?'Lepas':'Pin')+' timeframe">'+(pinned?'★':'☆')+'</button></div>';
  }).join('')+'</div>';
  openModal('Timeframe & Favorit',html,root=>{
   root.onclick=e=>{
    const star=e.target.closest('[data-timeframe-pin]');
    if(star){favorite('timeframes',star.dataset.timeframePin);timeframesModal();return}
    const select=e.target.closest('[data-timeframe-select]');
    if(select){updateTF(select.dataset.timeframeSelect);closeModal()}
   };
  });
 }
 function favoritesModal(){
  const sections=[
   ['symbols','Simbol',prefs.favorites.symbols,id=>marketInfo(id).symbol||id],
   ['timeframes','Timeframe',prefs.favorites.timeframes,labelTf],
   ['tools','Drawing tools',prefs.favorites.tools,id=>TOOLS[id]?.[0]||id],
   ['indicators','Indikator',prefs.favorites.indicators,id=>CATALOG.find(c=>c.id===id)?.name||id]
  ];
  const html='<p class="settings-note">Favorit disimpan otomatis di perangkat ini. Klik item untuk menghapusnya dari toolbar. Untuk menambahkan, gunakan Search, Timeframe, Indicators, atau tombol pin tool di bawah.</p>'+
   sections.map(([kind,name,items,label])=>'<div class="favorite-manage-section"><strong>'+name+' ('+items.length+')</strong><div class="favorite-manage-items">'+
    (items.map(id=>'<button data-remove-fav-kind="'+kind+'" data-remove-fav-id="'+esc(id)+'" title="Hapus favorit">★ '+esc(label(id))+' ×</button>').join('')||'<span class="settings-note">Belum ada favorit.</span>')+
    '</div></div>').join('')+
   '<div class="favorite-manage-section"><strong>Pin / lepas tool gambar</strong><div class="favorite-manage-items">'+
    Object.entries(TOOLS).map(([id,info])=>'<button data-pin-tool="'+esc(id)+'" title="Pin drawing tool">'+(current('tools',id)?'★ ':'☆ ')+esc(info[0])+'</button>').join('')+
   '</div></div>'+
   '<div class="modal-actions"><button class="mini-btn" id="favOpenSymbols">Cari simbol</button><button class="mini-btn" id="favOpenTimeframes">Timeframes</button><button class="primary-tiny" id="favDone">Selesai</button></div>';
  openModal('Kelola Favorit',html,root=>{
   root.onclick=e=>{
    const remove=e.target.closest('[data-remove-fav-kind]');
    if(remove){favorite(remove.dataset.removeFavKind,remove.dataset.removeFavId);favoritesModal();return}
    const tool=e.target.closest('[data-pin-tool]');if(tool){favorite('tools',tool.dataset.pinTool);favoritesModal();return}
    if(e.target.closest('#favOpenTimeframes'))timeframesModal();
    if(e.target.closest('#favDone'))closeModal();
    if(e.target.closest('#favOpenSymbols')){closeModal();el('symbolBtn')?.click()}
   };
  });
 }
 function chartSettingsModal(){
  const s=prefs.settings;
  const checks=[
   ['grid','Tampilkan grid'],['crosshair','Crosshair'],['lastPrice','Garis harga terakhir'],
   ['legend','OHLC dan legenda'],['watermark','Watermark Tradingwise']
  ];
  const boolFields=checks.map(([id,label])=>'<label><span>'+label+'</span><input data-chart-pref="'+id+'" type="checkbox" '+(s[id]?'checked':'')+'></label>').join('');
  const html='<div class="workspace-settings">'+
   '<h4>Tampilan chart</h4><div class="settings-group">'+boolFields+'</div>'+
   '<h4>Skala & navigasi</h4><div class="settings-group">'+
   '<label>Jenis skala <select data-chart-pref="priceScale"><option value="normal"'+(s.priceScale==='normal'?' selected':'')+'>Normal</option><option value="logarithmic"'+(s.priceScale==='logarithmic'?' selected':'')+'>Logaritmik</option><option value="percentage"'+(s.priceScale==='percentage'?' selected':'')+'>Persentase</option></select></label>'+
   '<label>Lebar candle <input data-chart-pref="barSpacing" type="range" min="3" max="22" step="1" value="'+s.barSpacing+'"></label>'+
   '<label>Offset kanan <input data-chart-pref="rightOffset" type="range" min="0" max="35" step="1" value="'+s.rightOffset+'"></label>'+
   '</div><h4>Warna candle</h4><div class="settings-group">'+
   '<label>Bullish <input data-chart-pref="upColor" type="color" value="'+s.upColor+'"></label>'+
   '<label>Bearish <input data-chart-pref="downColor" type="color" value="'+s.downColor+'"></label>'+
   '</div><h4>Workspace</h4><div class="settings-group">'+
   '<label>Toolbar favorit <input data-ui-pref="showFavoritesBar" type="checkbox" '+(prefs.showFavoritesBar?'checked':'')+'></label>'+
   '</div><p class="settings-note">Perubahan tersimpan otomatis di browser. Pilihan warna hanya mengubah tampilan; data OHLC tetap dari provider.</p>'+
   '<div class="modal-actions"><button class="mini-btn" id="chartSettingsReset">Reset default</button><button class="primary-tiny" id="chartSettingsDone">Selesai</button></div></div>';
  openModal('Chart Settings',html,root=>{
   root.oninput=e=>{
    const t=e.target,key=t.dataset.chartPref;
    if(!key&&!t.dataset.uiPref)return;
    if(key){prefs.settings[key]=t.type==='checkbox'?t.checked:t.type==='range'?Number(t.value):t.value}
    else prefs.showFavoritesBar=t.checked;
    save();apply();
   };
   root.onchange=root.oninput;
   root.onclick=e=>{
    if(e.target.closest('#chartSettingsReset')){prefs.settings={...DEFAULT_UI_PREFS.settings};save();apply();chartSettingsModal()}
    if(e.target.closest('#chartSettingsDone'))closeModal();
   };
  });
 }
 function watchlistSettings(){
  const sort=prefs.watchlistSort;
  const html='<p class="settings-note">Urutan manual mendukung tombol naik/turun. Favorit akan tampil lebih atas jika menggunakan urutan favorit.</p>'+
   '<div class="modal-row"><label>Urut berdasarkan</label><select id="watchSort">'+
   [['manual','Manual'],['favorites','Favorit dahulu'],['symbol','Nama simbol A-Z'],['change','Perubahan tertinggi']].map(([v,label])=>'<option value="'+v+'"'+(sort===v?' selected':'')+'>'+label+'</option>').join('')+
   '</select></div><div class="watchlist-menu">'+state.watchlist.map((id,index)=>
   '<div class="watchlist-order-row"><button data-watch-favorite="'+esc(id)+'" title="Favorit">'+(current('symbols',id)?'★':'☆')+'</button><span>'+esc(marketInfo(id).symbol||id)+'</span>'+
   '<button data-watch-up="'+esc(id)+'" title="Naik"'+(index===0?' disabled':'')+'>↑</button>'+
   '<button data-watch-down="'+esc(id)+'" title="Turun"'+(index===state.watchlist.length-1?' disabled':'')+'>↓</button>'+
   '<button data-watch-remove="'+esc(id)+'" title="Hapus dari watchlist" class="danger">×</button></div>'
   ).join('')+'</div><div class="modal-actions"><button id="watchDone" class="primary-tiny">Selesai</button></div>';
  openModal('Pengaturan Watchlist',html,root=>{
   root.onchange=e=>{if(e.target.id==='watchSort'){prefs.watchlistSort=e.target.value;save();renderWatchlist()}};
   root.onclick=e=>{
    if(e.target.closest('#watchDone')){closeModal();return}
    const item=e.target.closest('[data-watch-favorite],[data-watch-up],[data-watch-down],[data-watch-remove]');
    if(!item)return;
    const id=item.dataset.watchFavorite||item.dataset.watchUp||item.dataset.watchDown||item.dataset.watchRemove;
    if(item.dataset.watchFavorite){favorite('symbols',id);watchlistSettings();return}
    const i=state.watchlist.indexOf(id);if(i<0)return;
    if(item.dataset.watchRemove){state.watchlist.splice(i,1)}
    else{
     const j=i+(item.dataset.watchUp?-1:1);
     if(j>=0&&j<state.watchlist.length)[state.watchlist[i],state.watchlist[j]]=[state.watchlist[j],state.watchlist[i]];
     prefs.watchlistSort='manual';save();
    }
    persist();renderWatchlist();watchlistSettings();
   };
  });
 }
 function setLayout(key,value){
  if(!['sidebarCollapsed','panelCollapsed'].includes(key))return;
  prefs[key]=Boolean(value);save();
 }
 function importPrefs(value){
  prefs=normalizeUiPreferences(value);save();apply();
 }
 function install(){
  el('symbolFavoriteBtn').onclick=()=>favorite('symbols',state.symbol);
  el('drawingToolsBtn').onclick=drawingToolsModal;
  mountDesktopDrawingToolbar({layer:drawingLayer,hasFavorite:id=>current('tools',id),onFavorite:id=>favorite('tools',id)});
  window.addEventListener('tw:draw-tool',()=>{render()});
  el('tfMoreBtn').onclick=timeframesModal;
  el('chartSettingsBtn').onclick=chartSettingsModal;
  el('favoritesManageBtn').onclick=favoritesModal;
  el('favoritesBar').addEventListener('click',e=>{
   const symbol=e.target.closest('[data-quick-symbol]');
   const tool=e.target.closest('[data-quick-tool]');
   const indicator=e.target.closest('[data-quick-indicator]');
   if(symbol)updateSymbol(symbol.dataset.quickSymbol);
   if(tool){drawingLayer.setTool(tool.dataset.quickTool);render()}
   if(indicator){toggleIndicator(indicator.dataset.quickIndicator);render()}
  });
  document.querySelectorAll('.tool[data-tool]').forEach(btn=>
   btn.addEventListener('contextmenu',e=>{
    e.preventDefault();
    favorite('tools',btn.dataset.tool);
   })
  );
  document.addEventListener('keydown',e=>{
   if((e.ctrlKey||e.metaKey)&&e.key===','){e.preventDefault();chartSettingsModal()}
   if(e.altKey&&e.key.toLowerCase()==='f'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();favorite('symbols',state.symbol)}
  });
  apply();
 }
 return {
  install,render,apply,hasFavorite:current,toggleFavorite:favorite,
  orderWatchlist:order,favoriteCatalog,drawingToolsModal,timeframesModal,chartSettingsModal,watchlistSettings,favoritesModal,
  setLayout,importPrefs,exportPrefs:()=>normalizeUiPreferences(prefs),
  setDrawingFavoritesVisible(value){prefs.showDrawingFavorites=Boolean(value);save();render()},
  setChartPreference(key,value){if(key in prefs.settings){prefs.settings[key]=value;save();apply()}},
  get panelCollapsed(){return prefs.panelCollapsed},
  get sidebarCollapsed(){return prefs.sidebarCollapsed}
 };
}
