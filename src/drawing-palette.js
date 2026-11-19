import {TOOL_CATALOG} from './drawing-model.js';
import {PALETTE_GROUPS,LABELS,paletteGroups,canFavorite,isPaletteCommand} from './drawing-palette-model.js';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
// Original SVG glyphs, independent from proprietary asset packs.
const glyphs={
 ruler:'<path d="m3 19 16-16 6 6L9 25Z M7 15l3 3m1-7 3 3m1-7 3 3"/>',trend:'<path d="m5 23 18-18"/><circle cx="5" cy="23" r="2"/><circle cx="23" cy="5" r="2"/>',
 ray:'<path d="M5 23 26 2"/><circle cx="5" cy="23" r="2"/><circle cx="13" cy="15" r="2"/>',extended:'<path d="M2 26 26 2"/><circle cx="10" cy="18" r="2"/><circle cx="18" cy="10" r="2"/>',horizontal:'<path d="M2 14h24"/><circle cx="14" cy="14" r="2"/>',horizontalRay:'<path d="M5 14h21"/><circle cx="5" cy="14" r="2"/>',vertical:'<path d="M14 2v24"/><circle cx="14" cy="14" r="2"/>',crossline:'<path d="M14 2v24M2 14h24"/><circle cx="14" cy="14" r="2"/>',channel:'<path d="m4 20 15-15M10 26 25 11"/><circle cx="4" cy="20" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="25" cy="11" r="2"/>',
 regression:'<path d="m4 11 20-8v13L4 24Zm0 7 20-8"/>',fibo:'<path d="M3 4h22M3 10h22M3 16h22M3 22h22"/><circle cx="3" cy="22" r="2"/><circle cx="25" cy="10" r="2"/>',fibExtension:'<path d="m4 15 5-10 16-4M3 16h23M3 21h23M3 26h23"/><circle cx="9" cy="5" r="2"/>',
 circle:'<circle cx="14" cy="14" r="11"/><circle cx="14" cy="14" r="2"/><circle cx="25" cy="14" r="2"/>',fibCircle:'<circle cx="14" cy="14" r="12"/><circle cx="14" cy="14" r="8"/><circle cx="14" cy="14" r="4"/>',ellipse:'<ellipse cx="14" cy="14" rx="12" ry="8"/><circle cx="14" cy="6" r="1.5"/><circle cx="26" cy="14" r="1.5"/>',
 rectangle:'<rect x="4" y="4" width="20" height="20"/><circle cx="4" cy="4" r="2"/><circle cx="24" cy="24" r="2"/>',triangle:'<path d="M5 24 9 4 24 24Z"/><circle cx="9" cy="4" r="2"/>',curve:'<path d="M4 25Q5 3 25 4"/><circle cx="4" cy="25" r="2"/><circle cx="25" cy="4" r="2"/>',brush:'<path d="m4 21 2-7L19 1l7 7L13 21l-8 2Zm9 0c7 0 7 6 14 1"/>',highlighter:'<path d="m4 19 8-8 8 8-8 5Zm8-8 7-9m1 17 7-7"/>',eraser:'<path d="m4 18 13-13 8 8-12 12H8ZM12 10l9 9"/>',keep:'<path d="m3 19 15-15 5 5L8 24H3Zm20-1v8m-4-4h8"/>',hide:'<path d="M2 14q12-18 24 0-12 18-24 0Z"/><circle cx="14" cy="14" r="4"/>',lock:'<rect x="6" y="12" width="16" height="13" rx="2"/><path d="M10 12V7a4 4 0 0 1 8 0v5m-4 5v3"/>',magnet:'<path d="M5 25V12a9 9 0 0 1 18 0v13h-6V12a3 3 0 0 0-6 0v13Zm0-6h6m6 0h6"/>',clear:'<path d="M4 6h20M9 6V3h10v3M7 6l2 19h10l2-19M12 11v9m4-9v9"/>',zoomIn:'<circle cx="12" cy="12" r="9"/><path d="m19 19 7 7M7 12h10m-5-5v10"/>',zoomOut:'<circle cx="12" cy="12" r="9"/><path d="m19 19 7 7M7 12h10"/>',text:'<path d="M4 6V3h20v3M14 3v22m-5 0h10"/>',priceLabel:'<path d="M5 3h21v17H11l-6 5ZM11 9h9m-9 5h6"/>',long:'<path d="M3 5h23M3 14h23M3 23h23M13 7v12m-4-8 4-4 4 4"/>',short:'<path d="M3 5h23M3 14h23M3 23h23M13 7v12m-4-4 4 4 4-4"/>',priceRange:'<path d="M3 4h23M3 24h23M14 4v20m-4-16 4-4 4 4m-8 12 4 4 4-4"/>',dateRange:'<path d="M4 2v24M24 2v24M4 14h20m-16-4-4 4 4 4m12-8 4 4-4 4"/>',pointer:'<path d="m5 3 18 14-10 1-4 8Z"/>',emoji:'<circle cx="14" cy="14" r="12"/><path d="M8 16q6 8 12 0M9 10h.1m10 0h.1"/>',visualIcon:'<path d="M14 24 3 13C-2 3 10 0 14 8c4-8 16-5 11 5Z"/>',flag:'<path d="M5 26V3h20l-6 7 6 7H5"/>',pin:'<path d="M14 26S3 15 5 8a9 9 0 0 1 18 0c2 7-9 18-9 18Z"/><circle cx="14" cy="10" r="3"/>'
};
export function paletteIcon(id){
 let shape=glyphs[id];if(!shape){
  if(/elliott|xabcd|cypher|headShoulders|abcd|threeDrives|trianglePattern|path|polyline/i.test(id))shape='<path d="m3 23 5-13 7 9 6-15 5 9"/><circle cx="8" cy="10" r="2"/><circle cx="15" cy="19" r="2"/><circle cx="21" cy="4" r="2"/>';
  else if(/gannBox|gannSquare/.test(id))shape='<rect x="3" y="3" width="22" height="22"/><path d="M3 10h22M3 18h22M10 3v22M18 3v22M3 25 25 3"/>';
  else if(/pitch|Fan|Wedge/.test(id))shape='<path d="M3 25 4 3M3 25 15 3M3 25 25 9M3 25 25 20"/>';
  else if(/Time|cycle|Cycles/.test(id))shape='<path d="M4 3v22m7-22v22m7-22v22m7-22v22"/><circle cx="4" cy="10" r="2"/>';
  else if(/arc|Arc|Spiral|sector|sine/i.test(id))shape='<path d="M3 25Q3 3 25 3M3 25h22"/><circle cx="3" cy="25" r="2"/>';
  else if(/note|label|comment|post|idea|sign|table|sticker|image/i.test(id))shape=glyphs.priceLabel;
  else if(/arrow/i.test(id))shape='<path d="M4 24 24 4M13 4h11v11"/>';
 }
 return '<svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(shape||'<use href="#'+esc(TOOL_CATALOG[id]?.icon||'i-trend')+'"/>')+'</svg>';
}
export function mountDrawingPalette({openModal,closeModal,layer,chart,toast,render,getPrefs,onFavorite,setShowFavorites}){
 openModal('Gambar','<div id="drawingPaletteV2" class="drawing-palette-v2"><label class="drawing-grid-search"><svg aria-hidden="true"><use href="#i-search"/></svg><input type="search" id="drawingToolSearch" placeholder="Cari" aria-label="Cari drawing tools" autocomplete="off"></label><div id="drawingCategoryTabs" class="drawing-grid-tabs" role="tablist" aria-label="Kategori gambar"></div><div id="drawingToolList" class="drawing-grid-scroll"></div><footer class="drawing-grid-footer" id="drawingFavoritesFooter"><label>'+paletteIcon('brush')+'<span>Tampilkan favorit pada Chart</span><input type="checkbox" role="switch" id="drawingFavoritesSwitch"><span class="drawing-switch-track" aria-hidden="true"></span></label></footer><div id="drawingFavoriteMenu" class="drawing-grid-context hidden" role="dialog" aria-label="Favorit drawing"><div class="drawing-context-card"><strong id="drawingContextLabel"></strong><button type="button" id="drawingFavoriteAction"></button><button type="button" id="drawingContextCancel">Batal</button></div></div></div>',root=>{
  const $=id=>root.querySelector('#'+id),panel=$('drawingPaletteV2'),field=$('drawingToolSearch'),tabs=$('drawingCategoryTabs'),list=$('drawingToolList'),context=$('drawingFavoriteMenu'),footer=$('drawingFavoritesFooter');
  let tab='favorite',menuId=null,press=null,timer=null,suppressUntil=0,swipe=null;
  const tabList=[['favorite','Favorit'],...PALETTE_GROUPS.map(([id,label])=>[id,label])];
  tabs.innerHTML=tabList.map(([id,label])=>'<button type="button" role="tab" data-drawing-tab="'+id+'" aria-selected="'+(id===tab)+'">'+esc(label)+'</button>').join('');
  function paint(){
   const q=field.value,ids=getPrefs().favorites.tools,pins=new Set(ids);
   const groups=paletteGroups(tab,q,ids);const allGroups=tab==='favorite'||q.trim();
   const active=id=>id===layer.tool||id==='keep'&&layer.keepDrawing||id==='hide'&&layer.hidden||id==='lock'&&layer.lockAll||id==='magnet'&&layer.magnet;
   const label=id=>LABELS[id]+(id==='magnet'?' '+({off:'Off',weak:'Lemah',strong:'Kuat'}[layer.magnetMode]||'Off'):'');
   const tile=id=>'<button type="button" class="drawing-grid-tile'+(active(id)?' active':'')+'" data-draw-pick="'+id+'" title="'+esc(label(id))+'" aria-label="'+esc(label(id))+'" aria-pressed="'+active(id)+'">'+paletteIcon(id)+'<span class="drawing-tile-label">'+esc(label(id))+'</span>'+(pins.has(id)?'<span class="drawing-tile-star" aria-label="Favorit">★</span>':'')+'</button>';
   list.innerHTML=groups.map(g=>'<section class="drawing-tile-section">'+(allGroups?'<h3>'+esc(g.title)+'</h3>':'')+'<div class="drawing-tile-grid">'+g.items.map(tile).join('')+'</div></section>').join('')||'<div class="drawing-grid-empty"><strong>'+(q.trim()?'Tool tidak ditemukan':'Belum ada favorit')+'</strong><span>'+(q.trim()?'Coba kata kunci lain.':'Tahan lama pada tool di kategori lain, lalu pilih Favoritkan.')+'</span></div>';
   tabs.querySelectorAll('[data-drawing-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.drawingTab===tab)));
   footer.classList.toggle('hidden',tab!=='favorite'||!!q.trim());$('drawingFavoritesSwitch').checked=getPrefs().showDrawingFavorites;
  }
  // Keep the horizontal scrolling local to the categories; scrollIntoView can
  // also scroll the sheet's overflow-hidden ancestors on Android.
  function selectTab(id){
   const b=tabs.querySelector('[data-drawing-tab="'+id+'"]');if(!b)return;
   cancel();tab=id;field.value='';list.scrollTop=0;paint();
   const r=b.getBoundingClientRect(),t=tabs.getBoundingClientRect();
   if(r.left<t.left)tabs.scrollLeft+=r.left-t.left-8;
   else if(r.right>t.right)tabs.scrollLeft+=r.right-t.right+8;
  }
  function closeContext(){context.classList.add('hidden');menuId=null}
  function favoriteMenu(id){if(!panel.isConnected||!canFavorite(id))return;menuId=id;$('drawingContextLabel').textContent=LABELS[id]||TOOL_CATALOG[id].label;$('drawingFavoriteAction').textContent=getPrefs().favorites.tools.includes(id)?'Hapus dari favorit':'Favoritkan';context.classList.remove('hidden');suppressUntil=Date.now()+700}
  const cancel=()=>{clearTimeout(timer);timer=null;press=null};
  function beginPress(id,x,y,source,pointer){
   if(!canFavorite(id))return;cancel();press={id,x,y,source,pointer,started:Date.now()};
   timer=setTimeout(()=>{if(press&&panel.isConnected)favoriteMenu(press.id)},520);
  }
  function moved(x,y){if(press&&Math.hypot(x-press.x,y-press.y)>10)cancel()}
  // Touch and mouse are handled separately. Keep the pressed target until release;
  // Android may dispatch pointercancel when its native context gesture begins.
  list.addEventListener('touchstart',e=>{
   const b=e.target.closest('[data-draw-pick]'),t=e.touches[0];
   if(!t||e.touches.length!==1||menuId){swipe=null;cancel();return}
   swipe={x:t.clientX,y:t.clientY,pointer:t.identifier,axis:null};
   if(b)beginPress(b.dataset.drawPick,t.clientX,t.clientY,'touch',t.identifier);else cancel();
  },{passive:true});
  list.addEventListener('touchmove',e=>{
   if(e.touches.length!==1){swipe=null;cancel();return}
   if(swipe){
    const t=[...e.touches].find(x=>x.identifier===swipe.pointer);
    if(!t){swipe=null;cancel();return}
    const dx=Math.abs(t.clientX-swipe.x),dy=Math.abs(t.clientY-swipe.y);
    if(!swipe.axis&&Math.max(dx,dy)>12)swipe.axis=dx>dy*1.3?'x':dy>dx*1.3?'y':null;
   }
   if(press?.source==='touch'){const t=[...e.touches].find(x=>x.identifier===press.pointer);if(t)moved(t.clientX,t.clientY);else cancel()}
  },{passive:true});
  list.addEventListener('touchend',e=>{
   const g=swipe;swipe=null;
   const t=g&&[...e.changedTouches].find(x=>x.identifier===g.pointer);
   if(t&&!menuId&&!field.value.trim()&&g.axis!=='y'){
    const dx=t.clientX-g.x,dy=t.clientY-g.y;
    if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.4){
     cancel();suppressUntil=Date.now()+350;if(e.cancelable)e.preventDefault();
     const i=tabList.findIndex(([id])=>id===tab),next=tabList[i+(dx<0?1:-1)];
     if(next)selectTab(next[0]);return;
    }
   }
   if(press?.source==='touch'){const p=press,held=Date.now()-p.started>=520;cancel();if(held||menuId){if(held)favoriteMenu(p.id);if(e.cancelable)e.preventDefault()}}else if(menuId&&e.cancelable)e.preventDefault();
  },{passive:false});
  list.addEventListener('touchcancel',()=>{swipe=null;cancel()},{passive:true});
  list.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;const b=e.target.closest('[data-draw-pick]');if(b)beginPress(b.dataset.drawPick,e.clientX,e.clientY,'pointer',e.pointerId)},{passive:true});
  list.addEventListener('pointermove',e=>{if(press?.source==='pointer'&&e.pointerId===press.pointer)moved(e.clientX,e.clientY)},{passive:true});
  for(const type of ['pointerup','pointercancel','pointerleave'])list.addEventListener(type,()=>{if(press?.source==='pointer')cancel()},{passive:true});
  list.addEventListener('scroll',()=>{if(!menuId)cancel()},{passive:true});
  list.addEventListener('contextmenu',e=>{const b=e.target.closest('[data-draw-pick]');if(!b||!canFavorite(b.dataset.drawPick))return;e.preventDefault();favoriteMenu(b.dataset.drawPick);if(press?.source!=='touch')cancel()});
  list.addEventListener('keydown',e=>{const b=e.target.closest('[data-draw-pick]');if(b&&(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))){e.preventDefault();favoriteMenu(b.dataset.drawPick)}});
  function run(id){
   if(!isPaletteCommand(id)){closeModal();layer.setTool(id);render();return}
   if(id==='keep')layer.keepDrawing=!layer.keepDrawing;
   else if(id==='hide')layer.hidden=!layer.hidden;
   else if(id==='lock')layer.lockAll=!layer.lockAll;
   else if(id==='magnet')layer.cycleMagnet();
   else if(id==='clear'){if(confirm('Hapus semua drawing pada chart aktif?')){layer.clear();closeModal();return}}
   else if(id==='zoomIn'||id==='zoomOut'){closeModal();chart.zoomBy(id==='zoomIn'?1.35:1/1.35);return}
   layer.syncControls();layer.render();paint();
  }
  list.onclick=e=>{const b=e.target.closest('[data-draw-pick]');if(!b||Date.now()<suppressUntil||menuId)return;run(b.dataset.drawPick)};
  tabs.onclick=e=>{const b=e.target.closest('[data-drawing-tab]');if(b)selectTab(b.dataset.drawingTab)};
  field.oninput=()=>{cancel();list.scrollTop=0;paint()};
  $('drawingFavoriteAction').onclick=()=>{const id=menuId;if(id){onFavorite(id);closeContext();paint()}};
  $('drawingContextCancel').onclick=closeContext;context.onclick=e=>{if(e.target===context&&Date.now()>=suppressUntil)closeContext()};
  $('drawingFavoritesSwitch').onchange=e=>setShowFavorites(e.target.checked);
  paint();
 });
}
