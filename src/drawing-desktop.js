// Tradingwise desktop drawing flyouts. Uses only original vector icons and
// supported chart tools, never TradingView code or assets.
import {DESKTOP_GROUPS,desktopGroupItems} from './drawing-desktop-model.js';
import {paletteIcon} from './drawing-palette.js';

const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function mountDesktopDrawingToolbar({layer,hasFavorite,onFavorite}){
 const flyout=document.getElementById('desktopDrawingFlyout');
 if(!flyout)return;
 const buttons=[...document.querySelectorAll('[data-drawing-group]')];
 const lastUsed=Object.fromEntries(DESKTOP_GROUPS.map(g=>[g.id,g.defaultTool]));
 let active=null,trigger=null,searchValue='';
 function groupForTool(tool){
  return DESKTOP_GROUPS.find(g=>desktopGroupItems(g.id).some(item=>item.id===tool));
 }
 function sync(){
  const current=groupForTool(layer.tool);
  if(current)lastUsed[current.id]=layer.tool;
  for(const b of buttons){
   const id=b.dataset.drawingGroup,g=DESKTOP_GROUPS.find(x=>x.id===id);
   const selected=Boolean(current&&current.id===id);
   b.classList.toggle('active',selected);
   b.setAttribute('aria-pressed',String(selected));
   b.setAttribute('aria-expanded',String(id===active));
   const image=b.querySelector('[data-group-icon]');
   if(image&&g)image.innerHTML=paletteIcon(lastUsed[id]);
   if(g)b.title=g.label+' · '+(desktopGroupItems(id).find(x=>x.id===lastUsed[id])?.label||g.label);
  }
 }
 function close(restore=false){
  const old=trigger;active=null;trigger=null;flyout.classList.add('hidden');
  flyout.innerHTML='';sync();if(restore)old?.focus();
 }
 function paint(){
  if(!active)return;
  const list=flyout.querySelector('[data-desktop-list]');
  if(!list)return;
  const items=desktopGroupItems(active,searchValue);
  list.innerHTML=items.map(item=>
   '<div class="desktop-drawing-item"><button type="button" class="desktop-drawing-pick" data-draw-pick="'+esc(item.id)+'" title="'+esc(item.translatedLabel)+'">'+paletteIcon(item.id)+'<span class="desktop-drawing-label"><strong>'+esc(item.label)+'</strong><small>'+esc(item.translatedLabel)+'</small></span><span class="desktop-drawing-points">'+(item.points===0?'Mode':item.id==='brush'||item.id==='highlighter'?'Drag':['path','polyline'].includes(item.id)?'Multi':item.points+' pt')+'</span></button>'+(item.points>0?'<button type="button" class="desktop-drawing-pin'+(hasFavorite(item.id)?' is-favorite':'')+'" data-draw-pin="'+esc(item.id)+'" title="Favorit '+esc(item.label)+'" aria-label="Favorit '+esc(item.label)+'" aria-pressed="'+hasFavorite(item.id)+'">'+(hasFavorite(item.id)?'★':'☆')+'</button>':'')+'</div>'
  ).join('')||'<div class="desktop-drawing-empty">Tidak ada tool pada kategori ini.</div>';
  flyout.querySelector('[data-desktop-count]').textContent=items.length+' tool';
 }
 function open(id,button){
  const group=DESKTOP_GROUPS.find(g=>g.id===id);
  if(!group||window.matchMedia('(max-width:760px)').matches)return;
  active=id;trigger=button;searchValue='';
  flyout.innerHTML='<div class="desktop-drawing-title"><strong>'+esc(group.label)+'</strong><span data-desktop-count></span><button type="button" data-desktop-close aria-label="Tutup kategori">×</button></div><label class="desktop-drawing-search"><svg aria-hidden="true"><use href="#i-search"/></svg><input type="search" data-desktop-search aria-label="Cari tool dalam kategori" placeholder="Cari tool..." autocomplete="off"></label><div data-desktop-list class="desktop-drawing-list"></div><p class="desktop-drawing-help">Pilih tool untuk menggambar. ★ menambah favorit.</p>';
  flyout.classList.remove('hidden');
  const rect=button.getBoundingClientRect(),width=312,height=Math.min(600,innerHeight-110);
  flyout.style.left=Math.max(0,Math.min(innerWidth-width-8,rect.right+5))+'px';
  flyout.style.top=Math.max(46,Math.min(rect.top,innerHeight-height-34))+'px';
  flyout.style.maxHeight=height+'px';
  const field=flyout.querySelector('[data-desktop-search]');
  field.addEventListener('input',()=>{searchValue=field.value;paint()});
  paint();sync();
 }
 for(const b of buttons){
  b.addEventListener('click',()=>active===b.dataset.drawingGroup?close():open(b.dataset.drawingGroup,b));
 }
 flyout.addEventListener('click',e=>{
  if(e.target.closest('[data-desktop-close]')){close(true);return}
  const star=e.target.closest('[data-draw-pin]');
  if(star){onFavorite(star.dataset.drawPin);paint();return}
  const pick=e.target.closest('[data-draw-pick]');
  if(pick){layer.setTool(pick.dataset.drawPick);close();return}
 });
 document.addEventListener('pointerdown',e=>{
  if(active&&!e.target.closest('#desktopDrawingFlyout,[data-drawing-group]'))close();
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();close(true)}},true);
 window.addEventListener('tw:draw-tool',sync);
 window.addEventListener('resize',()=>{if(active)close()});
 sync();
}
