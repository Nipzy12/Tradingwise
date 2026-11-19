import {renderAdvanced,NOTE_TYPES} from './drawing-advanced.js';
import {POINT_KEYS,TOOL_CATALOG,isVariablePath,MAX_PATH_POINTS,clone,anchor,normalizeAnchor,resolveAnchor,normalizeDrawing,normalizeStyle,normalizeRisk,normalizeLevels,seedPosition,positionStats,shiftDrawing,rangeStats,fibPrices,clipLine} from './drawing-model.js';
const $=id=>document.getElementById(id);
const enc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const freehand=t=>t==='brush'||t==='highlighter';
const position=t=>t==='long'||t==='short';
const one=t=>TOOL_CATALOG[t]?.points===1;
const n=x=>Number.isFinite(x)?Number(x.toFixed(3)):0;
const xy=p=>n(p.x)+','+n(p.y);
const deep=a=>clone(a);
const round=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:6}):'–';
export class DrawingLayer{
 constructor(chart,{onChange,onToast,getKey}){
  Object.assign(this,{chart,onChange,onToast,getKey,svg:$('drawingOverlay'),stage:$('chartStage'),tool:'pointer',drawings:[],undoStack:[],redoStack:[],preview:null,hidden:false,magnet:false,magnetMode:'off',keepDrawing:false,lockAll:false,selected:null,ready:false,pending:null,gesture:null,templates:{}});
  try{this.templates=JSON.parse(localStorage.getItem('tw-drawing-templates-v1')||'{}')||{}}catch{}
  this.install();this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(this.stage);
  this.chart.engine.onVisible=()=>this.render();
 }
 install(){
  for(const [event,method] of [['pointerdown','down'],['pointermove','move'],['pointerup','up']])this.svg.addEventListener(event,e=>this[method](e));
  this.svg.addEventListener('pointercancel',()=>this.cancelGesture());
  const schedule=()=>{if(this.resizeFrame)return;this.resizeFrame=requestAnimationFrame(()=>{this.resizeFrame=null;this.render()})};
  this.stage.addEventListener('pointermove',e=>{if(this.tool==='pointer'&&!this.gesture&&e.buttons)schedule()},{passive:true});
  this.stage.addEventListener('wheel',schedule,{passive:true});
  this.svg.addEventListener('dblclick',e=>{if(isVariablePath(this.tool)&&this.pending){e.preventDefault();e.stopPropagation();this.finishPath();return}const id=e.target.closest('[data-drawing-id]')?.dataset.drawingId;if(id&&this.tool==='pointer'){e.preventDefault();e.stopPropagation();this.onEdit?.(id)}});
  this.svg.addEventListener('contextmenu',e=>{if(isVariablePath(this.tool)&&this.pending){e.preventDefault();e.stopPropagation();this.finishPath()}});
  this.stage.addEventListener('pointerdown',e=>{if(this.tool==='pointer'&&!e.target.closest('[data-drawing-id],#drawingQuickBar'))this.select(null)});
  document.addEventListener('keydown',e=>{
   if(['TEXTAREA','INPUT','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable||!$('modalBackdrop')?.classList.contains('hidden'))return;
   if((e.key==='Delete'||e.key==='Backspace')&&this.selected){e.preventDefault();this.remove(this.selected)}
   if(e.key==='Escape'){if(isVariablePath(this.tool)&&this.finishPath()){e.preventDefault();return}this.setTool('pointer');this.select(null)}
  });
  $('drawingQuickBar')?.addEventListener('click',e=>{
   const action=e.target.closest('[data-drawing-action]')?.dataset.drawingAction,id=this.selected;
   if(!action||!id)return;
   if(action==='edit')this.onEdit?.(id);
   if(action==='lock')this.toggleFlag(id,'locked');
   if(action==='hide')this.toggleFlag(id,'hidden');
   if(action==='duplicate')this.duplicate(id);
   if(action==='delete')this.remove(id);
   if(action==='close')this.select(null);
  });
  $('drawingQuickBar')?.addEventListener('change',e=>{
   const key=({drawingQuickColor:'color',drawingQuickWidth:'width',drawingQuickDash:'dash'})[e.target.id];
   const current=this.drawings.find(d=>d.id===this.selected);
   if(!key||!current||this.tool!=='pointer')return;
   const style=normalizeStyle(current.type,{...current.style,[key]:key==='width'?Number(e.target.value):e.target.value});
   if(style[key]!==current.style[key])this.update(current.id,{style});
  });
  $('drawingHintCancel')?.addEventListener('click',()=>this.setTool('pointer'));
  $('drawingHintFinish')?.addEventListener('click',()=>this.finishPath());
  this.syncControls();
 }
 setReady(ready){this.ready=Boolean(ready);if(!ready){this.pending=null;this.preview=null;this.gesture=null;this.selected=null;this.drawings=[];this.undoStack=[];this.redoStack=[];this.setTool('pointer')}this.render()}
 setTool(tool){
  if(!TOOL_CATALOG[tool])return;
  if(tool!=='pointer'&&!this.ready){this.onToast?.('Tunggu market data dimuat.');return}
  this.cancelGesture();this.pending=null;this.preview=null;this.tool=tool;this.selected=null;
  this.stage.classList.toggle('drawing-mode',tool!=='pointer');
  this.svg.style.pointerEvents=tool==='pointer'||tool==='eraser'?'none':'auto';
  this.svg.style.cursor=tool==='pointer'?'default':tool==='eraser'?'not-allowed':'crosshair';
  this.syncControls();this.render();this.onSelect?.();window.dispatchEvent(new Event('tw:draw-tool'));
 }
 syncControls(){
  document.querySelectorAll('.tool[data-tool],[data-quick-tool],[data-mobile-tool]').forEach(b=>{const active=(b.dataset.tool||b.dataset.quickTool||b.dataset.mobileTool)===this.tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  for(const [id,active] of [['magnetBtn',this.magnet],['keepDrawingBtn',this.keepDrawing],['lockDrawingsBtn',this.lockAll],['hideDrawingsBtn',this.hidden]]){const b=$(id);b?.classList.toggle('active',active);b?.setAttribute('aria-pressed',String(active))}
  if($('magnetBtn'))$('magnetBtn').title='Magnet: '+this.magnetMode+' (klik untuk mode berikutnya)';
  const hint=$('drawingHint'),caption=$('drawingHintText'),finish=$('drawingHintFinish'),variable=isVariablePath(this.tool);if(finish)finish.classList.toggle('hidden',!variable||(this.pending?.anchors.length||0)<2);
  if(hint&&caption){hint.classList.toggle('hidden',this.tool==='pointer');caption.textContent=this.tool==='eraser'?'Ketuk objek untuk menghapus':(TOOL_CATALOG[this.tool]?.label||this.tool)+' · '+(variable?(this.pending?'Tambah titik atau Selesai':'Ketuk titik awal'):this.pending?'Tentukan titik '+(this.pending.anchors.length+1):one(this.tool)?'Ketuk chart':freehand(this.tool)?'Gambar dengan drag':'Ketuk titik awal atau drag')}
 }
 setMagnet(mode){this.magnetMode=['off','weak','strong'].includes(mode)?mode:'off';this.magnet=this.magnetMode!=='off';this.syncControls()}
 cycleMagnet(){const a=['off','weak','strong'];this.setMagnet(a[(a.indexOf(this.magnetMode)+1)%a.length]);this.onToast?.('Magnet: '+this.magnetMode)}
 select(id){const next=this.drawings.some(x=>x.id===id)?id:null;if(next===this.selected)return;this.selected=next;this.render();this.onSelect?.()}
 bounds(){
  const w=this.stage.clientWidth,h=this.stage.clientHeight;let scale=74,plotH=h-24;
  try{scale=this.chart.engine.chart.priceScale('right').width()||scale;const pane=this.chart.engine.chart.panes()[0];if(pane?.getHeight)plotH=Math.min(plotH,pane.getHeight())}catch{if(this.chart.engine.mainHeight>0)plotH=Math.min(plotH,this.chart.engine.mainHeight)}
  return {w,h,right:Math.max(0,w-scale),bottom:Math.max(0,plotH)}
 }
 fromEvent(e,{snap=true,clamp=false}={}){
  if(!this.ready||!this.chart.candles.length)return null;
  const rect=this.svg.getBoundingClientRect(),bounds=this.bounds();let x=e.clientX-rect.left,y=e.clientY-rect.top;
  if(!clamp&&(x<0||x>bounds.right||y<0||y>bounds.bottom))return null;
  x=Math.max(0,Math.min(bounds.right,x));y=Math.max(0,Math.min(bounds.bottom,y));
  let logical=this.chart.coordinateToLogical(x),price=this.chart.coordinateToPrice(y);
  if(logical===null||price===null||!Number.isFinite(logical)||!Number.isFinite(price))return null;
  if(snap&&this.magnet){const i=Math.round(logical),bar=this.chart.candles[i];
   if(bar){const values=[bar.open,bar.high,bar.low,bar.close].filter(Number.isFinite);let nearest=null,distance=Infinity;for(const v of values){const yy=this.chart.priceToCoordinate(v),d=Math.abs(yy-y);if(Number.isFinite(yy)&&d<distance){nearest=v;distance=d}}
    if(nearest!==null&&(this.magnetMode==='strong'||distance<=13)){logical=i;price=nearest}
   }
  }
  return anchor(this.chart.candles,logical,price);
 }
 capture(e){try{this.svg.setPointerCapture(e.pointerId)}catch{}}
 release(e){try{this.svg.releasePointerCapture(e.pointerId)}catch{}}
 make(type,points){
  const a=points[0],b=points[1]||a,c=points[2],item={type,a,b,c,style:normalizeStyle(type,this.templates[type]?.style),text:this.templates[type]?.text||''};
  for(let i=3;i<POINT_KEYS.length&&i<points.length;i++)item[POINT_KEYS[i]]=points[i];
  if(position(type)){Object.assign(item,seedPosition(type,a,b,this.chart.candles));item.risk=normalizeRisk(this.templates[type]?.risk)}
  if(['fibo','fibExtension'].includes(type)){item.levels=normalizeLevels(this.templates[type]?.levels,type);item.reverse=this.templates[type]?.reverse===true}
  if(isVariablePath(type)){item.points=points;item.a=points[0];item.b=points.at(-1);item.c=undefined}
  if(freehand(type)){item.points=points;item.a=points[0];item.b=points.at(-1)}
  return item;
 }
 down(e){
  if(!this.ready||e.button!==0||this.gesture)return;
  const hit=e.target.closest('[data-drawing-id]'),id=hit?.dataset.drawingId,handle=e.target.closest('[data-handle]')?.dataset.handle;
  if(this.tool==='pointer'||this.tool==='eraser'){
   if(!id)return;e.preventDefault();e.stopPropagation();this.select(id);
   if(this.tool==='eraser'){if(!this.lockAll&&!this.drawings.find(d=>d.id===id)?.locked)this.remove(id);else this.onToast?.('Objek dikunci.');return}
   const d=this.drawings.find(x=>x.id===id),p=this.fromEvent(e,{snap:false});if(!d||d.locked||this.lockAll||!p)return;
   this.gesture={mode:'edit',id,handle,original:deep(d),before:deep(this.drawings),start:p,x:e.clientX,y:e.clientY,moved:false};this.capture(e);return;
  }
  const p=this.fromEvent(e);if(!p)return;
  e.preventDefault();e.stopPropagation();this.capture(e);
  if(one(this.tool)){
   const item=this.make(this.tool,[p]);
   if(this.tool==='text'||NOTE_TYPES.includes(this.tool)){const defaults={emoji:'⭐',sticker:'🚀',visualIcon:'♥',flag:'⚑',pin:'●',idea:'💡'};const txt=prompt('Teks atau simbol anotasi chart:',item.text||defaults[this.tool]||'Catatan analisis');if(!txt?.trim()){this.release(e);this.finishTool();return}item.text=txt}
   this.add(item);this.release(e);this.finishTool();return;
  }
  this.gesture={mode:'create',first:p,last:p,x:e.clientX,y:e.clientY,moved:false,points:[p]};
  const previous=this.pending?.anchors||[];const draft=[...previous,p,p];this.preview=this.make(this.tool,isVariablePath(this.tool)?draft:draft.slice(0,TOOL_CATALOG[this.tool].points));
  this.render();
 }
 move(e){
  const g=this.gesture;
  if(!g){
   if(this.pending&&this.tool!=='pointer'&&!freehand(this.tool)&&e.pointerType==='mouse'){
    const p=this.fromEvent(e);if(p){this.preview=this.make(this.tool,[...this.pending.anchors,p]);this.render()}
   }
   return;
  }
  if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>5)g.moved=true;
  if(!g.moved)return;
  const p=this.fromEvent(e,{snap:g.mode==='create'||Boolean(g.handle),clamp:true});if(!p)return;
  e.preventDefault();
  if(g.mode==='edit'){
   let d=deep(g.original);
   if(isVariablePath(d.type)&&/^p\d+$/.test(g.handle||'')&&d.points[Number(g.handle.slice(1))]){const i=Number(g.handle.slice(1));d.points[i]=p;d.a=d.points[0];d.b=d.points.at(-1)}
   else if(g.handle&&POINT_KEYS.includes(g.handle)){
    d[g.handle]=p;
    if(one(d.type)&&g.handle==='a')d.b=p;
   }else d=shiftDrawing(d,this.chart.candles,p.logical-g.start.logical,p.price-g.start.price);
   this.drawings=this.drawings.map(x=>x.id===g.id?d:x);
  }else{
   g.last=p;
   if(freehand(this.tool)){const last=g.points.at(-1);if(g.points.length<600&&(Math.abs(last.logical-p.logical)>.08||Math.abs(last.price-p.price)>1e-9))g.points.push(p);this.preview=this.make(this.tool,g.points)}
   else{const previous=this.pending?.anchors||[];const points=previous.length?[...previous,p]:[g.first,p];this.preview=this.make(this.tool,points)}
  }
  this.render();
 }
 up(e){
  const g=this.gesture;if(!g)return;
  this.release(e);this.gesture=null;
  if(g.mode==='edit'){
   if(g.moved){const d=this.drawings.find(x=>x.id===g.id),fixed=normalizeDrawing(d,this.chart.candles);if(!fixed){this.drawings=g.before;this.onToast?.('Koordinat tidak valid: TP dan SL harus berlawanan sisi entry.');this.render();return}this.drawings=this.drawings.map(x=>x.id===g.id?fixed:x);this.remember(g.before);this.changed()}else this.render();return;
  }
  const p=this.fromEvent(e,{clamp:true})||g.last;
  let points;
  if(isVariablePath(this.tool)){
   const previous=this.pending?.anchors||[],next=previous.length?[...previous,p]:g.moved?[g.first,p]:[g.first];
   if(previous.length>=3&&this.tool==='polyline'&&this.nearVertex(previous[0],p)){this.finishPath(true);return}
   if(previous.length&&this.nearVertex(previous.at(-1),p))next.pop();
   this.pending={anchors:next};this.preview=this.make(this.tool,next);
   if(next.length>=MAX_PATH_POINTS){this.finishPath();return}this.syncControls();this.render();return;
  }
  if(freehand(this.tool)){
   if(!g.moved||g.points.length<2){this.preview=null;this.render();return}points=g.points;
  }else{
   const previous=this.pending?.anchors||[];
   points=previous.length?[...previous,p]:g.moved?[g.first,p]:[g.first];
   if(points.length<TOOL_CATALOG[this.tool].points){this.pending={anchors:points};this.preview=this.make(this.tool,[...points,p]);this.syncControls();this.render();return}
  }
  this.add(this.make(this.tool,points));this.pending=null;this.preview=null;this.finishTool();this.render();
 }
 nearVertex(a,b){if(!a||!b)return false;const q=this.chart.logicalToCoordinate&&this.chart.priceToCoordinate?this.point(a):null,r=q?this.point(b):null;return q&&r?Math.hypot(q.x-r.x,q.y-r.y)<=8:Math.abs(a.logical-b.logical)<1e-8&&Math.abs(a.price-b.price)<1e-8}
 finishPath(closed=false){
  if(!isVariablePath(this.tool)||!this.pending||this.pending.anchors.length<2)return false;
  const points=this.pending.anchors,item=this.make(this.tool,points);item.closed=closed&&this.tool==='polyline';
  this.pending=null;this.preview=null;const id=this.add(item);if(!id){this.syncControls();this.render();return false}this.finishTool();this.render();return true;
 }
 cancelGesture(){
  if(this.gesture?.mode==='edit')this.drawings=this.gesture.before;
  this.gesture=null;this.pending=null;this.preview=null;this.render();
 }
 finishTool(){if(!this.keepDrawing){const selected=this.selected;this.setTool('pointer');this.select(selected)}else{this.pending=null;this.preview=null;this.syncControls();this.render()}}
 remember(before=this.drawings){this.undoStack.push(deep(before));if(this.undoStack.length>60)this.undoStack.shift();this.redoStack=[]}
 add(item){
  const fixed=normalizeDrawing(item,this.chart.candles);if(!fixed){this.onToast?.('Titik drawing tidak valid.');return null}
  if(this.drawings.length>=500){this.onToast?.('Maksimal 500 objek per chart.');return null}
  this.remember();this.drawings.push(fixed);this.selected=fixed.id;this.changed();return fixed.id;
 }
 update(id,patch){
  const old=this.drawings.find(x=>x.id===id);if(!old)return false;
  const next=normalizeDrawing({...old,...patch,id,type:old.type},this.chart.candles);if(!next)return false;
  this.remember();this.drawings=this.drawings.map(x=>x.id===id?next:x);this.changed();return true;
 }
 toggleFlag(id,key){if(!['locked','hidden'].includes(key))return;const d=this.drawings.find(x=>x.id===id);if(d)this.update(id,{[key]:!d[key]})}
 duplicate(id){const d=this.drawings.find(x=>x.id===id);if(!d)return;const copy=shiftDrawing(d,this.chart.candles,3,0);delete copy.id;copy.locked=false;copy.hidden=false;return this.add(copy)}
 saveTemplate(d){this.templates[d.type]={style:normalizeStyle(d.type,d.style),levels:d.levels,risk:d.risk,text:d.text,reverse:d.reverse};try{localStorage.setItem('tw-drawing-templates-v1',JSON.stringify(this.templates))}catch{}}
 remove(id){if(!this.drawings.some(x=>x.id===id))return;this.remember();this.drawings=this.drawings.filter(x=>x.id!==id);if(this.selected===id)this.selected=null;this.changed()}
 clear(){if(!this.drawings.length)return;this.remember();this.drawings=[];this.selected=null;this.changed()}
 undo(){if(!this.undoStack.length)return;this.redoStack.push(deep(this.drawings));this.drawings=this.undoStack.pop();this.selected=null;this.changed()}
 redo(){if(!this.redoStack.length)return;this.undoStack.push(deep(this.drawings));this.drawings=this.redoStack.pop();this.selected=null;this.changed()}
 load(items){this.ready=this.chart.candles.length>0;this.pending=null;this.preview=null;this.gesture=null;this.drawings=(Array.isArray(items)?items:[]).slice(0,500).map(x=>normalizeDrawing(x,this.chart.candles)).filter(Boolean);this.undoStack=[];this.redoStack=[];this.selected=null;this.changed()}
 changed(){this.render();this.onChange?.();this.onSelect?.()}
 point(p){if(!p)return null;const l=resolveAnchor(this.chart.candles,p).logical,x=this.chart.logicalToCoordinate(l),y=this.chart.priceToCoordinate(p.price);return x!==null&&y!==null&&Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null}
 render(){
  const {w,h,right,bottom}=this.bounds();if(w<10||h<10)return;
  this.svg.setAttribute('viewBox','0 0 '+w+' '+h);this.svg.setAttribute('width',w);this.svg.setAttribute('height',h);
  const current=this.drawings.find(x=>x.id===this.selected),bar=$('drawingQuickBar');if(bar){bar.classList.toggle('hidden',!current||this.hidden||this.tool!=='pointer');$('drawingSelectedName').textContent=current?TOOL_CATALOG[current.type]?.label||current.type:'';bar.querySelector('[data-drawing-action="lock"]')?.classList.toggle('active',!!current?.locked);bar.querySelector('[data-drawing-action="hide"]')?.classList.toggle('active',!!current?.hidden)}
  if(current&&bar){
   const style=normalizeStyle(current.type,current.style);
   for(const [id,value] of [['drawingQuickColor',style.color],['drawingQuickWidth',String(style.width)],['drawingQuickDash',style.dash]]){
    const el=$(id);if(el&&el.value!==value)el.value=value;
   }
  }
  if(this.hidden||!this.ready){this.svg.innerHTML='';return}
  const parts=['<defs><clipPath id="drawClip"><rect x="0" y="0" width="'+right+'" height="'+bottom+'"/></clipPath></defs><g clip-path="url(#drawClip)">'];
  for(const d of [...this.drawings,...(this.preview?[this.preview]:[])]){
   if(d.hidden||!d.a||!d.b)continue;
   const a=this.point(d.a),b=this.point(d.b),c=this.point(d.c);if(!a||!b)continue;
   const active=d.id&&this.selected===d.id,style=normalizeStyle(d.type,d.style),id=d.id?' data-drawing-id="'+enc(d.id)+'"':'',color=style.color,dash=style.dash==='dashed'?'7 4':style.dash==='dotted'?'2 4':'none';
   const stroke=' stroke="'+color+'" stroke-width="'+style.width+'" stroke-dasharray="'+dash+'"';
   const group=['<g'+id+'>'];
   const line=(aa,bb,extra='',mode='segment')=>{
    const clipped=clipLine(aa,bb,right,bottom,mode);if(!clipped)return;const [q,r]=clipped,coords=' x1="'+n(q.x)+'" y1="'+n(q.y)+'" x2="'+n(r.x)+'" y2="'+n(r.y)+'"';
    group.push('<line'+coords+stroke+' '+extra+' pointer-events="stroke"/><line'+coords+' stroke="transparent" stroke-width="18" pointer-events="stroke"/>');
   };
   const label=(x,y,text,fill=color)=>group.push('<text x="'+n(x)+'" y="'+n(y)+'" font-size="11" font-family="Arial,sans-serif" fill="'+fill+'" paint-order="stroke" stroke="var(--deep,#090b0e)" stroke-width="2" pointer-events="none">'+enc(text)+'</text>');
   const rect=(x1,y1,x2,y2,fill=style.fill,opacity=style.opacity,edge=color)=>group.push('<rect x="'+n(Math.min(x1,x2))+'" y="'+n(Math.min(y1,y2))+'" width="'+Math.max(1,n(Math.abs(x2-x1)))+'" height="'+Math.max(1,n(Math.abs(y2-y1)))+'" fill="'+fill+'" fill-opacity="'+opacity+'" stroke="'+edge+'" stroke-width="'+style.width+'" stroke-dasharray="'+dash+'" pointer-events="all"/>');
   const t=d.type;
   if(renderAdvanced({d,a,b,c,right,bottom,line,label,rect,group,stroke,style,color,chart:this.chart,point:p=>this.point(p),n,xy,enc,round})){}
   else if(['trend','ray','extended','arrow','ruler'].includes(t)){
    line(a,b,'',t==='ray'?'ray':t==='extended'?'extended':'segment');
    if(t==='arrow'){const ang=Math.atan2(b.y-a.y,b.x-a.x),size=11;group.push('<polygon points="'+xy(b)+' '+xy({x:b.x-size*Math.cos(ang-.5),y:b.y-size*Math.sin(ang-.5)})+' '+xy({x:b.x-size*Math.cos(ang+.5),y:b.y-size*Math.sin(ang+.5)})+'" fill="'+color+'"/>')}
    if(t==='ruler'){const q=rangeStats(d,this.chart.candles);rect(a.x,a.y,b.x,b.y);label(Math.min(a.x,b.x)+5,Math.min(a.y,b.y)-5,round(q.diff)+' ('+round(q.percent)+'%) · '+q.bars+' bars')}
   }else if(['horizontal','horizontalRay','liquidity','crossline'].includes(t)){
    line({x:['horizontalRay','liquidity'].includes(t)?a.x:0,y:a.y},{x:right,y:a.y});
    if(t==='crossline')line({x:a.x,y:0},{x:a.x,y:bottom});
    if(t==='liquidity')label(Math.min(right-80,a.x+5),a.y-5,d.text||'Liquidity');
    else label(Math.max(0,right-92),a.y-5,this.chart.formatPrice(d.a.price));
   }else if(t==='vertical'){line({x:a.x,y:0},{x:a.x,y:bottom})}
   else if(['rectangle','obZone','fvgZone'].includes(t)){
    rect(a.x,a.y,style.extend?right:b.x,b.y);if(t!=='rectangle'||d.text)label(Math.max(0,Math.min(a.x,b.x)+5),Math.min(a.y,b.y)+13,d.text||({obZone:'OB',fvgZone:'FVG'}[t]||''));
   }else if(t==='ellipse'){
    group.push('<ellipse cx="'+n((a.x+b.x)/2)+'" cy="'+n((a.y+b.y)/2)+'" rx="'+Math.max(1,Math.abs(b.x-a.x)/2)+'" ry="'+Math.max(1,Math.abs(b.y-a.y)/2)+'" fill="'+style.fill+'" fill-opacity="'+style.opacity+'"'+stroke+' pointer-events="all"/>');
   }else if(t==='triangle'){
    const end=c||b;group.push('<polygon points="'+[a,b,end].map(xy).join(' ')+'" fill="'+style.fill+'" fill-opacity="'+style.opacity+'"'+stroke+' pointer-events="all"/>');
   }else if(t==='channel'){
    const q=c||b,dx=b.x-a.x,offset=q.y-(a.y+(Math.abs(dx)>0.01?(b.y-a.y)*(q.x-a.x)/dx:0));
    const aa={x:a.x,y:a.y+offset},bb={x:b.x,y:b.y+offset};group.push('<polygon points="'+[a,b,bb,aa].map(xy).join(' ')+'" fill="'+style.fill+'" fill-opacity="'+style.opacity+'" pointer-events="all"/>');line(a,b);line(aa,bb);line({x:a.x,y:a.y+offset/2},{x:b.x,y:b.y+offset/2},'opacity=".45"');
   }else if(t==='fibo'||t==='fibExtension'){
    line(a,b,'opacity=".4"');if(c)line(b,c,'opacity=".4"');
    const start=t==='fibExtension'?(c?.x??b.x):Math.min(a.x,b.x),low=style.extendLeft?0:start,high=style.extend?right:Math.max(start+36,a.x,b.x,c?.x??0);
    for(const level of fibPrices(d)){const y=this.chart.priceToCoordinate(level.price);if(y===null||!Number.isFinite(y))continue;line({x:low,y},{x:high,y},level.level===.618?'opacity="1"':'opacity=".75"');label(low+4,y-3,level.level+' ('+this.chart.formatPrice(level.price)+')')}
   }else if(t==='text'||t==='priceLabel'){
    const txt=t==='priceLabel'?this.chart.formatPrice(d.a.price):d.text||'Note';group.push('<text x="'+n(a.x+5)+'" y="'+n(a.y-4)+'" fill="'+color+'" font-size="13" font-weight="600" pointer-events="all">'+enc(txt)+'</text>');
   }else if(freehand(t)){
    const points=(d.points||[d.a,d.b]).map(p=>this.point(p)).filter(Boolean),coords=points.map(xy).join(' ');
    group.push('<polyline points="'+coords+'" fill="none" stroke="'+color+'" stroke-width="'+style.width+'" stroke-opacity="'+(t==='highlighter'?Math.max(.08,style.opacity):1)+'" stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke"/><polyline points="'+coords+'" fill="none" stroke="transparent" stroke-width="'+Math.max(style.width,16)+'" pointer-events="stroke"/>');
   }else if(position(t)){
    const stats=positionStats(d);if(c&&stats){const start=Math.min(a.x,b.x),end=Math.max(a.x+12,b.x,a.x);
     rect(start,a.y,end,b.y,'#089981',.23,'#089981');rect(start,a.y,end,c.y,'#f23645',.23,'#f23645');line({x:start,y:a.y},{x:end,y:a.y});
     label(start+4,Math.min(a.y,b.y)+13,'TP '+this.chart.formatPrice(d.b.price)+' · RR '+stats.rr.toFixed(2),'#58d5b8');label(start+4,Math.max(a.y,c.y)-4,'SL '+this.chart.formatPrice(d.c.price)+' · Qty '+round(stats.qty),'#ff8d9b');
    }
   }else if(t==='priceRange'||t==='dateRange'){
    const q=rangeStats(d,this.chart.candles);
    if(t==='priceRange'){rect(a.x,a.y,Math.abs(b.x-a.x)<24?a.x+24:b.x,b.y);label(a.x+4,Math.min(a.y,b.y)-4,round(q.diff)+' ('+round(q.percent)+'%)')}
    else{rect(a.x,0,b.x,bottom);label(Math.min(a.x,b.x)+4,20,q.bars+' bars · '+round(q.seconds/60)+' min')}
   }
   if(active&&!this.lockAll&&!d.locked&&!freehand(t)&&this.tool==='pointer'){
    const handles=isVariablePath(t)?d.points.map((p,i)=>['p'+i,this.point(p)]).filter(([,q])=>q):one(t)?[['a',a]]:POINT_KEYS.filter(key=>d[key]).map(key=>[key,this.point(d[key])]).filter(([,q])=>q);
    for(const [key,q] of handles){group.push('<circle cx="'+n(q.x)+'" cy="'+n(q.y)+'" r="5" fill="#11141b" stroke="#b8cdff" stroke-width="2" data-handle="'+key+'" pointer-events="all"/><circle cx="'+n(q.x)+'" cy="'+n(q.y)+'" r="12" fill="transparent" data-handle="'+key+'" pointer-events="all"/>')}
   }
   group.push('</g>');parts.push(...group);
  }
  parts.push('</g>');this.svg.innerHTML=parts.join('');
 }
}
