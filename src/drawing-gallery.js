import {TOOL_CATALOG,TOOL_IDS} from './drawing-model.js';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const icon=id=>'<svg aria-hidden="true"><use href="#'+esc(id)+'"/></svg>';
const item=(id,label,ic,action)=>({id,label,icon:ic||TOOL_CATALOG[id]?.icon||'i-grid',action,available:!!TOOL_CATALOG[id]||!!action,pinnable:TOOL_IDS.includes(id)});
const missing=(id,label,ic)=>item(id,label,ic);
export const GALLERY_GROUPS=[
 ['Peralatan',[item('ruler','Pengukuran'),item('eraser','Penghapus','i-d-erase'),item('keep','Tetap menggambar','i-keep','keep'),item('hide','Sembunyikan gambar','i-eye','hide'),item('lock','Kunci seluruh gambar','i-lock','lock'),item('magnet','Magnet','i-magnet','magnet'),item('clear','Hapus gambar','i-trash','clear'),item('zoomIn','Perbesar','i-d-zoomplus','zoomIn'),item('zoomOut','Perkecil','i-d-zoomminus','zoomOut'),item('pointer','Kursor')]],
 ['Peralatan Tren',[item('trend','Garis Tren'),item('ray','Sinar','i-d-ray'),item('infoLine','Garis Info'),item('extended','Garis Perpanjangan'),item('trendAngle','Sudut Tren'),item('horizontal','Garis Horizontal'),item('horizontalRay','Sinar Horizontal','i-d-hRay'),item('vertical','Garis Vertikal'),item('crossline','Garis Persilangan','i-d-cross'),item('channel','Kanal Paralel','i-d-channel'),item('regression','Tren Regresi'),item('flatChannel','Puncak/Dasar Datar'),item('disjointChannel','Kanal Disjoin'),item('pitchfork','Pitchfork'),missing('schiff','Schiff Pitchfork','i-d-pitchfork'),missing('modifiedSchiff','Pitchfork Schiff Modifikasi','i-d-pitchfork'),missing('insidePitchfork','Pitchfork Dalam','i-d-pitchfork')]],
 ['Gann dan Fibonacci',[item('fibo','Fib Retracement'),item('fibExtension','Fib Ekstensi Berbasis Tren'),item('fibChannel','Fib Kanal'),item('fibTime','Fib Zona Waktu'),item('fibFan','Fib Kipas Resistansi'),missing('fibTrendTime','Fib Waktu Berbasis Tren','i-d-time'),item('fibCircle','Fib Lingkaran'),missing('fibSpiral','Fib Spiral','i-d-circle'),missing('fibArc','Fib Busur Resistansi','i-d-arc'),missing('fibWedge','Fib Baji','i-d-sector'),missing('pitchfan','Pitchfan','i-d-fan'),item('gannBox','Kotak Gann'),missing('gannFixed','Kotak Gann Tetap','i-d-gann'),missing('gannSquare','Persegi Gann','i-d-gann'),item('gannFan','Kipas Gann')]],
 ['Motif',[item('xabcd','Motif XABCD'),missing('cypher','Motif Cypher','i-d-pattern'),missing('headShoulders','Head dan Shoulders','i-d-pattern'),item('abcd','Motif ABCD'),item('triangle','Motif Segitiga','i-d-triangle'),missing('threeDrives','Three Drives','i-d-pattern'),item('elliottImpulse','Gelombang Impuls Elliott'),item('elliottCorrection','Gelombang Koreksi Elliott'),item('elliottTriangle','Gelombang Segitiga Elliott'),missing('doubleCombo','Gelombang Kombinasi Ganda','i-d-wave'),missing('tripleCombo','Gelombang Kombinasi Tiga','i-d-wave'),item('cycleLines','Garis Siklus'),missing('timeCycles','Siklus Waktu','i-d-time'),item('sineLine','Garis Sinus')]],
 ['Proyeksi dan pengukuran',[item('long','Posisi Pembelian','i-d-long'),item('short','Posisi Penjualan','i-d-short'),item('projection','Prediksi Posisi (manual)'),missing('barPattern','Motif Bar','i-candles'),missing('ghostFeed','Ghost Feed','i-candles'),item('sector','Sektor'),item('anchoredVwap','VWAP Terjangkar'),missing('fixedVolume','Profil Volume Rentang Tetap','i-chart'),missing('anchoredVolume','Profil Volume Terjangkar','i-chart'),item('priceRange','Rentang Harga'),item('dateRange','Rentang Tanggal'),item('ruler','Rentang Tanggal dan Harga')]],
 ['Bentuk-bentuk geometris',[item('brush','Kuas','i-d-brush'),item('highlighter','Penanda','i-d-brush'),item('arrow','Penanda Panah','i-d-path'),item('arrow','Panah','i-d-ray'),item('arrowUp','Tanda Panah Atas'),item('arrowDown','Tanda Panah Bawah'),item('rectangle','Persegi'),item('rotatedRect','Persegi Terputar'),item('path','Jalur'),item('circle','Lingkaran'),item('ellipse','Elips','i-d-ellipse'),item('polyline','Polyline'),item('triangle','Segitiga','i-d-triangle'),item('arc','Busur'),item('curve','Kurva'),item('doubleCurve','Kurva Ganda')]],
 ['Anotasi',[item('text','Teks'),missing('anchoredText','Teks Terjangkar','i-text'),item('note','Catatan'),item('priceNote','Catatan Harga'),item('pin','Pin'),missing('table','Tabel','i-grid'),item('label','Label'),item('comment','Komentar'),item('priceLabel','Label Harga'),missing('signpost','Signpost','i-star'),item('flag','Tanda Bendera'),missing('image','Gambar','i-d-note'),missing('post','Post','i-text'),item('idea','Ide')]],
 ['Visual',[item('emoji','Emoji'),item('sticker','Stiker'),item('chartIcon','Ikon')]],
 ['SMC / ICT',[item('obZone','Order Block'),item('fvgZone','Fair Value Gap'),item('liquidity','Liquidity Level')]]
];
export function galleryGroups(tab,query,pins=[]){
 const q=String(query||'').trim().toLowerCase(),seen=new Set();
 return GALLERY_GROUPS.flatMap(([name,items])=>{
  if(!q&&tab!=='Favorit'&&tab!==name)return [];
  const list=items.filter(t=>{
   if(tab==='Favorit'&&!q&&(!t.pinnable||!pins.includes(t.id)))return false;
   if(q&&!([t.label,t.id,TOOL_CATALOG[t.id]?.label,name].join(' ').toLowerCase().includes(q)))return false;
   if(tab==='Favorit'&&!q){if(seen.has(t.id))return false;seen.add(t.id)}
   return true;
  });return list.length?[[name,list]]:[];
 });
}
export function openDrawingGallery({openModal,closeModal,drawingLayer,chart,current,pins,toggle,getStrip,setStrip,render,toast}){
 let tab='Favorit',hold=null,suppressUntil=0,menuItem=null;
 openModal('Gambar','<div id="drawingGallery" class="drawing-gallery"><label class="drawing-gallery-search">'+icon('i-search')+'<input type="search" id="drawingToolSearch" placeholder="Cari" aria-label="Cari drawing tools" autocomplete="off"></label><div id="drawingGalleryTabs" class="drawing-gallery-tabs" role="tablist" aria-label="Kategori gambar">'+['Favorit',...GALLERY_GROUPS.map(x=>x[0])].map(name=>'<button type="button" role="tab" data-draw-tab="'+esc(name)+'" aria-selected="'+(name==='Favorit')+'">'+esc(name)+'</button>').join('')+'</div><div id="drawingToolList" class="drawing-gallery-scroll"></div><footer id="drawingGalleryFooter"><label>'+icon('i-star')+'<span>Tampilkan favorit pada Chart</span><input id="drawingFavoritesSwitch" type="checkbox" role="switch" aria-label="Tampilkan favorit pada Chart"><i aria-hidden="true"></i></label></footer><div id="drawingGalleryContext" class="drawing-gallery-context hidden" role="presentation"><div class="drawing-gallery-context-card" role="dialog" aria-label="Opsi tool"><strong id="drawingGalleryContextTitle"></strong><button id="drawingGalleryToggle" type="button"></button><button id="drawingGalleryCancel" type="button">Batal</button></div></div></div>',root=>{
  const $=id=>root.querySelector('#'+id),search=$('drawingToolSearch'),list=$('drawingToolList'),tabs=$('drawingGalleryTabs'),footer=$('drawingGalleryFooter'),pop=$('drawingGalleryContext'),sw=$('drawingFavoritesSwitch');
  const all=GALLERY_GROUPS.flatMap(g=>g[1]);const find=id=>all.find(t=>t.id===id);
  function cancelHold(){if(hold){clearTimeout(hold.timer);hold=null}}
  function active(t){return t.action==='keep'?drawingLayer.keepDrawing:t.action==='hide'?drawingLayer.hidden:t.action==='lock'?drawingLayer.lockAll:t.action==='magnet'?drawingLayer.magnetMode!=='off':t.id===drawingLayer.tool}
  function paint(){
   const groups=galleryGroups(tab,search.value,pins()),heading=tab==='Favorit'||!!search.value.trim();
   list.innerHTML=groups.map(([name,items])=>(heading?'<h3>'+esc(name)+'</h3>':'')+'<div class="drawing-gallery-grid">'+items.map(t=>'<button type="button" class="drawing-gallery-tile'+(active(t)?' active':'')+'" data-draw-pick="'+esc(t.id)+'" title="'+esc(t.label+(t.available?'':' · Belum tersedia'))+'" aria-label="'+esc(t.label+(t.available?'':' · Belum tersedia'))+'" '+(!t.available?'disabled':'')+'>'+icon(t.icon)+'<span>'+esc(t.id==='magnet'?'Magnet · '+drawingLayer.magnetMode:t.label)+'</span>'+(t.pinnable&&current('tools',t.id)?'<span class="drawing-gallery-star" aria-label="Favorit">★</span>':'')+(!t.available?'<small>Belum tersedia</small>':'')+'</button>').join('')+'</div>').join('')||'<div class="drawing-gallery-empty">'+(search.value.trim()?'Tidak ada tool yang cocok.':'Belum ada favorit. Tahan lama pada alat untuk memfavoritkan.')+'</div>';
   tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.drawTab===tab)));footer.classList.toggle('hidden',tab!=='Favorit'||!!search.value.trim());sw.checked=getStrip();
  }
  function showContext(t){if(!t?.pinnable||!root.isConnected||!pop.isConnected)return;menuItem=t;cancelHold();suppressUntil=Date.now()+1000;$('drawingGalleryContextTitle').textContent=t.label;$('drawingGalleryToggle').textContent=current('tools',t.id)?'★ Hapus dari favorit':'☆ Favoritkan';pop.classList.remove('hidden');$('drawingGalleryToggle').focus({preventScroll:true})}
  function closeContext(){pop.classList.add('hidden');menuItem=null}
  function select(t){
   if(!t?.available)return;
   switch(t.action){
    case 'keep':drawingLayer.keepDrawing=!drawingLayer.keepDrawing;break;
    case 'hide':drawingLayer.hidden=!drawingLayer.hidden;break;
    case 'lock':drawingLayer.lockAll=!drawingLayer.lockAll;break;
    case 'magnet':drawingLayer.cycleMagnet();break;
    case 'clear':if(confirm('Hapus semua drawing pada chart ini?'))drawingLayer.clear();break;
    case 'zoomIn':closeModal();chart.zoomBy(.72);return;
    case 'zoomOut':closeModal();chart.zoomBy(1.39);return;
    default:closeModal();drawingLayer.setTool(t.id);render();return;
   }
   drawingLayer.syncControls();drawingLayer.render();paint();
  }
  tabs.onclick=e=>{const b=e.target.closest('[data-draw-tab]');if(!b)return;tab=b.dataset.drawTab;search.value='';closeContext();paint();list.scrollTop=0;b.scrollIntoView({block:'nearest',inline:'nearest'})};
  search.oninput=()=>{closeContext();paint();list.scrollTop=0};
  list.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-draw-pick]'),t=find(b?.dataset.drawPick);if(!t?.pinnable||!e.isPrimary||e.button!==0)return;cancelHold();hold={x:e.clientX,y:e.clientY,pointer:e.pointerId,timer:setTimeout(()=>showContext(t),520)}});
  list.addEventListener('pointermove',e=>{if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10)cancelHold()});
  for(const event of ['pointerup','pointercancel','pointerleave','scroll'])list.addEventListener(event,cancelHold,{passive:true});
  list.addEventListener('contextmenu',e=>{const b=e.target.closest('[data-draw-pick]'),t=find(b?.dataset.drawPick);if(t?.pinnable){e.preventDefault();showContext(t)}});
  list.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){const t=find(e.target.closest('[data-draw-pick]')?.dataset.drawPick);if(t?.pinnable){e.preventDefault();showContext(t)}}});
  list.onclick=e=>{if(Date.now()<suppressUntil||!pop.classList.contains('hidden')){e.preventDefault();return}const b=e.target.closest('[data-draw-pick]');if(b)select(find(b.dataset.drawPick))};
  $('drawingGalleryToggle').onclick=()=>{if(menuItem){toggle(menuItem.id);closeContext();paint()}suppressUntil=0};
  $('drawingGalleryCancel').onclick=()=>{closeContext();suppressUntil=0};
  pop.onclick=e=>{if(e.target===pop)closeContext()};
  sw.onchange=()=>setStrip(sw.checked);
  paint();
 });
}
