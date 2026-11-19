import {TOOL_CATALOG} from './drawing-model.js';
export const DRAW_TABS=['Favorit','Peralatan','Peralatan Tren','Gann dan Fibonacci','Motif','Proyeksi dan pengukuran','Bentuk-bentuk geometris','Anotasi','Visual','SMC / ICT'];
const groups=[
 ['Peralatan',[['ruler','Pengukuran'],['eraser','Penghapus'],['pointer','Kursor'],['keep','Tetap menggambar'],['hide','Sembunyikan semua'],['lock','Kunci seluruh gambar'],['magnet','Magnet'],['clear','Hapus gambar'],['zoomIn','Perbesar'],['zoomOut','Perkecil']]],
 ['Peralatan Tren',[['trend','Garis Tren'],['ray','Sinar'],['extended','Garis Perpanjangan'],['horizontal','Garis Horizontal'],['horizontalRay','Sinar Horizontal'],['vertical','Garis Vertikal'],['crossline','Garis Persilangan'],['channel','Kanal Paralel']]],
 ['Gann dan Fibonacci',[['fibo','Fib Retracement'],['fibExtension','Fib Ekstensi Berbasis Tren'],['fibTime','Fib Zona Waktu'],['fibCircle','Fib Lingkaran']]],
 ['Motif',[['patternXABCD','Motif XABCD'],['patternABCD','Motif ABCD'],['waveImpulse','Gelombang Impuls Elliott'],['waveABC','Gelombang Koreksi Elliott']]],
 ['Proyeksi dan pengukuran',[['long','Posisi Pembelian'],['short','Posisi Penjualan'],['priceRange','Rentang Harga'],['dateRange','Rentang Tanggal'],['ruler','Rentang Tanggal dan Harga']]],
 ['Bentuk-bentuk geometris',[['brush','Kuas'],['highlighter','Penanda'],['arrow','Panah'],['arrowUp','Tanda panah atas'],['arrowDown','Tanda panah bawah'],['rectangle','Persegi'],['circle','Lingkaran'],['ellipse','Elips'],['triangle','Segitiga'],['curve','Kurva']]],
 ['Anotasi',[['text','Teks'],['note','Catatan'],['priceNote','Catatan Harga'],['priceLabel','Label Harga'],['flag','Tanda Bendera']]],
 ['Visual',[['emoji','Emoji'],['iconMark','Ikon']]],
 ['SMC / ICT',[['obZone','Order Block'],['fvgZone','Fair Value Gap'],['liquidity','Liquidity']]]
];
const modeIcons={keep:'i-keep',hide:'i-eye',lock:'i-lock',magnet:'i-magnet',clear:'i-trash',zoomIn:'i-search',zoomOut:'i-search'};
export const DRAW_GROUPS=groups.map(([group,rows])=>[group,rows.map(([id,label])=>({id,label,group,icon:TOOL_CATALOG[id]?.icon||modeIcons[id]||'i-grid',pinnable:!!TOOL_CATALOG[id]?.points,english:TOOL_CATALOG[id]?.label||''}))]);
export function paletteGroups(tab,query,favorites){
 const q=String(query||'').trim().toLowerCase(),pins=new Set(favorites||[]),seen=new Set();
 const out=[];
 for(const [group,items] of DRAW_GROUPS){
  if(!q&&tab!=='Favorit'&&tab!==group)continue;
  const visible=items.filter(t=>q?(t.label+' '+t.english+' '+t.id).toLowerCase().includes(q):tab==='Favorit'?pins.has(t.id):true).filter(t=>{if((q||tab==='Favorit')&&seen.has(t.id))return false;seen.add(t.id);return true});
  if(visible.length)out.push([group,visible]);
 }
 return out;
}
const art={
 trend:'M5 26L27 4 M5 26m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M27 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
 ray:'M5 27L29 3 M5 27m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',extended:'M2 30L30 2 M11 21m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
 horizontal:'M3 16H29 M14 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0',horizontalRay:'M6 16H30 M4 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0',vertical:'M16 2V30 M14 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0',crossline:'M16 2V30M2 16H30',
 channel:'M3 22L24 3 29 10 8 29Z M6 25L26 6',fibo:'M3 4H29M3 10H29M3 16H29M3 22H29M3 28H29',fibExtension:'M3 15L21 3 8 15M8 17H30M8 22H30M8 28H30',fibCircle:'M16 16m-14 0a14 14 0 1 0 28 0a14 14 0 1 0-28 0 M16 16m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M16 16m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',fibTime:'M3 5V27M8 4V28M15 4V28M29 4V28',
 ruler:'M3 23L23 3 29 9 9 29Z M8 18l4 4m1-9 4 4m1-9 4 4',long:'M3 5H29M3 17H29M3 27H29M13 20V10l-4 4m4-4 4 4',short:'M3 5H29M3 17H29M3 27H29M13 10V22l-4-4m4 4 4-4',
 priceRange:'M3 5H29M3 27H29M16 7V25m-4-14 4-4 4 4m-8 10 4 4 4-4',dateRange:'M5 2V30M27 2V30M7 16H25m-4-4 4 4-4 4',rectangle:'M4 4H28V28H4Z',circle:'M16 16m-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0 M16 16H28',ellipse:'M2 16a14 9 0 1 0 28 0a14 9 0 1 0-28 0',triangle:'M4 28L12 4 28 28Z',curve:'M3 28Q4 5 29 4',brush:'M4 24L21 5l6 6L10 30 4 24M3 29Q15 20 26 26',highlighter:'M4 22L20 5l8 8-16 16-8-7M3 30H20',arrow:'M3 29L28 4M18 4H28V14',arrowUp:'M16 3L29 17H22V29H10V17H3Z',arrowDown:'M16 29L29 15H22V3H10V15H3Z',text:'M6 6H26M16 6V28M11 28H21',note:'M4 4H28V22H16L9 29V22H4Z',priceNote:'M4 4H28V23H4ZM16 8V19M12 11h8',priceLabel:'M5 4H28V24H12L5 29Z',flag:'M5 29V4H27L21 12 27 20H5',emoji:'M16 16m-13 0a13 13 0 1 0 26 0a13 13 0 1 0-26 0 M10 19Q16 26 22 19M10 11h1M21 11h1',iconMark:'M16 28L4 16C-3 5 10 0 16 10 22 0 35 5 28 16Z',waveABC:'M2 25L10 7 19 22 29 4',waveImpulse:'M2 29L7 17 12 23 18 5 23 12 30 2',patternXABCD:'M3 28L9 4 16 19 24 6 29 28 9 4M3 28L16 19 29 28',patternABCD:'M4 27L9 5 25 9 28 28Z M9 5L28 28M4 27L25 9',obZone:'M3 9H29V23H3Z M8 5V28',fvgZone:'M3 12H29V22H3Z M9 4V10M22 24V30',liquidity:'M3 17H29M4 9L9 17 14 9'
};
export function paletteIcon(t){
 const path=art[t.id];return path?'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="'+path+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg aria-hidden="true"><use href="#'+t.icon+'"/></svg>';
}
export function mountDrawingPalette(root,{drawingLayer,chart,getPrefs,toggleFavorite,setShow,closeModal,render,toast}){
 const search=root.querySelector('#drawingToolSearch'),tabs=root.querySelector('#drawingTabs'),list=root.querySelector('#drawingToolList'),foot=root.querySelector('#drawingFavoriteFooter'),menu=root.querySelector('#drawingHoldMenu');
 let tab='Favorit',held=null,pressed=null,timer=null,suppressUntil=0;
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 function paint(){
  const prefs=getPrefs(),pins=prefs.favorites.tools;
  tabs.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.drawTab===tab);b.setAttribute('aria-selected',String(b.dataset.drawTab===tab))});
  const groups=paletteGroups(tab,search.value,pins);
  list.innerHTML=groups.map(([group,tools])=>'<section class="drawing-tile-section">'+((tab==='Favorit'||search.value.trim())?'<h3>'+esc(group)+'</h3>':'')+'<div class="drawing-tile-grid">'+tools.map(t=>{
   const active=({keep:drawingLayer.keepDrawing,hide:drawingLayer.hidden,lock:drawingLayer.lockAll,magnet:drawingLayer.magnet})[t.id]||drawingLayer.tool===t.id;
   return '<button type="button" class="drawing-tile'+(active?' active':'')+'" data-draw-pick="'+t.id+'" data-pinnable="'+t.pinnable+'" title="'+esc(t.label)+'" aria-label="'+esc(t.label)+'" aria-pressed="'+!!active+'">'+paletteIcon(t)+(pins.includes(t.id)?'<span class="drawing-tile-star" aria-label="Favorit">★</span>':'')+'<span class="drawing-tile-name">'+esc(t.id==='magnet'?'Magnet '+({off:'Off',weak:'Lemah',strong:'Kuat'}[drawingLayer.magnetMode]):t.label)+'</span></button>';
  }).join('')+'</div></section>').join('')||'<div class="drawing-empty">'+(tab==='Favorit'&&!search.value.trim()?'Belum ada favorit. Tahan lama pada alat untuk menambahkannya.':'Alat tidak ditemukan.')+'</div>';
  foot.hidden=tab!=='Favorit'&&!!search.value.trim();
  const sw=root.querySelector('#drawingShowFavorites');sw.checked=prefs.showDrawingFavorites===true;
 }
 function cancel(){clearTimeout(timer);timer=null;pressed=null}
 function openHold(id){if(!TOOL_CATALOG[id]?.points)return;held=id;suppressUntil=Date.now()+800;const pin=getPrefs().favorites.tools.includes(id);menu.querySelector('strong').textContent=DRAW_GROUPS.flatMap(x=>x[1]).find(x=>x.id===id)?.label||id;menu.querySelector('[data-hold-toggle]').textContent=pin?'Hapus dari favorit':'Favoritkan';menu.hidden=false;}
 function closeHold(){menu.hidden=true;held=null}
 function select(id){
  if(TOOL_CATALOG[id]){closeModal();drawingLayer.setTool(id);render();return}
  if(id==='keep')drawingLayer.keepDrawing=!drawingLayer.keepDrawing;
  else if(id==='hide')drawingLayer.hidden=!drawingLayer.hidden;
  else if(id==='lock')drawingLayer.lockAll=!drawingLayer.lockAll;
  else if(id==='magnet')drawingLayer.cycleMagnet();
  else if(id==='clear'){if(confirm('Hapus semua drawing pada chart ini?'))drawingLayer.clear()}
  else if(id==='zoomIn'||id==='zoomOut'){closeModal();chart.zoomBy(id==='zoomIn'?.75:1.33);return}
  drawingLayer.syncControls();drawingLayer.render();paint();
 }
 tabs.onclick=e=>{const b=e.target.closest('[data-draw-tab]');if(!b)return;cancel();closeHold();tab=b.dataset.drawTab;search.value='';paint();list.scrollTop=0;b.scrollIntoView({block:'nearest',inline:'nearest'})};
 search.oninput=()=>{cancel();closeHold();paint();list.scrollTop=0};
 list.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-draw-pick]');if(!b||b.dataset.pinnable!=='true'||e.button!==0)return;cancel();pressed={id:b.dataset.drawPick,x:e.clientX,y:e.clientY,pointer:e.pointerId};timer=setTimeout(()=>{if(pressed)openHold(pressed.id)},550)});
 list.addEventListener('pointermove',e=>{if(pressed&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>9)cancel()});
 for(const name of ['pointerup','pointercancel','pointerleave','scroll'])list.addEventListener(name,cancel,{passive:true});
 list.addEventListener('contextmenu',e=>{const b=e.target.closest('[data-draw-pick]');if(b&&b.dataset.pinnable==='true'){e.preventDefault();cancel();openHold(b.dataset.drawPick)}});
 list.addEventListener('keydown',e=>{const b=e.target.closest('[data-draw-pick]');if(b&&b.dataset.pinnable==='true'&&(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))){e.preventDefault();openHold(b.dataset.drawPick)}});
 list.onclick=e=>{const b=e.target.closest('[data-draw-pick]');if(!b||!menu.hidden||Date.now()<suppressUntil)return;select(b.dataset.drawPick)};
 menu.onclick=e=>{if(e.target.closest('[data-hold-toggle]')&&held){toggleFavorite('tools',held);closeHold();paint()}else if(e.target.closest('[data-hold-cancel]')||e.target===menu)closeHold()};
 root.querySelector('#drawingShowFavorites').onchange=e=>{setShow(e.target.checked);paint()};
 paint();
}
export function paletteMarkup(){
 return '<div class="drawing-palette-v2"><label class="drawing-search-box"><svg aria-hidden="true"><use href="#i-search"/></svg><input id="drawingToolSearch" type="search" placeholder="Cari" aria-label="Cari drawing tools" autocomplete="off"></label><div id="drawingTabs" class="drawing-tabs" role="tablist">'+DRAW_TABS.map(t=>'<button type="button" role="tab" data-draw-tab="'+t+'">'+t+'</button>').join('')+'</div><div id="drawingToolList" class="drawing-tile-scroll"></div><label id="drawingFavoriteFooter" class="drawing-favorite-footer"><svg aria-hidden="true"><use href="#i-keep"/></svg><span>Tampilkan favorit pada Chart</span><input type="checkbox" role="switch" id="drawingShowFavorites" aria-label="Tampilkan favorit pada Chart"></label><div id="drawingHoldMenu" class="drawing-hold-backdrop" hidden><div class="drawing-hold-menu" role="dialog" aria-label="Opsi favorit"><strong></strong><button type="button" data-hold-toggle></button><button type="button" data-hold-cancel>Batal</button></div></div></div>';
}
