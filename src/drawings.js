const $=id=>document.getElementById(id);
const encode=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/>/g,'&gt;');
const fibLevels=[0,.236,.382,.5,.618,.786,1];
export class DrawingLayer{
 constructor(chart,{onChange,onToast,getKey}){
  this.chart=chart;this.onChange=onChange;this.onToast=onToast;this.getKey=getKey;
  this.svg=$('drawingOverlay');this.stage=$('chartStage');this.tool='pointer';this.drawings=[];this.undoStack=[];this.redoStack=[];this.preview=null;this.hidden=false;this.magnet=false;this.selected=null;this.install();
  const resize=new ResizeObserver(()=>this.render());resize.observe(this.stage);this.resizeObserver=resize;
  if(this.chart.isLW){this.chart.engine.onVisible=()=>this.render()}
  else{this.chart.engine.onVisible=()=>this.render()}
 }
 install(){
  this.svg.addEventListener('pointerdown',e=>this.down(e));this.svg.addEventListener('pointermove',e=>this.move(e));this.svg.addEventListener('pointerup',e=>this.up(e));this.svg.addEventListener('pointercancel',()=>{this.preview=null;this.render()});
  this.svg.addEventListener('click',e=>{const id=e.target.closest('[data-drawing-id]')?.dataset.drawingId;if(id&&this.tool==='pointer'){this.selected=id;this.render();this.onChange?.()}});
  document.addEventListener('keydown',e=>{if(['TEXTAREA','INPUT'].includes(document.activeElement?.tagName))return;if((e.key==='Delete'||e.key==='Backspace')&&this.selected){this.remove(this.selected)}if(e.key==='Escape'){this.setTool('pointer');this.selected=null;this.preview=null;this.render()}})
 }
 setTool(tool){this.tool=tool;this.stage.classList.toggle('drawing-mode',tool!=='pointer');this.svg.style.pointerEvents=tool==='pointer'?'none':'auto';this.svg.style.cursor=tool==='pointer'?'default':'crosshair';document.querySelectorAll('.tool[data-tool]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tool===tool));}
 fromEvent(e){const rect=this.svg.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const logical=this.chart.coordinateToLogical(x),price=this.chart.coordinateToPrice(y);if(logical===null||price===null||!Number.isFinite(logical)||!Number.isFinite(price))return null;
  if(this.magnet){const idx=Math.max(0,Math.min(this.chart.candles.length-1,Math.round(logical)));const candle=this.chart.candles[idx];if(candle){const points=[candle.high,candle.low,candle.open,candle.close];let near=points[0];for(const p of points)if(Math.abs(this.chart.priceToCoordinate(p)-y)<Math.abs(this.chart.priceToCoordinate(near)-y))near=p;return{logical:idx,price:near}}}
  return {logical,price};
 }
 down(e){if(this.tool==='pointer')return;if(e.button!==0)return;const p=this.fromEvent(e);if(!p)return;e.preventDefault();e.stopPropagation();if(this.tool==='text'){const text=prompt('Teks anotasi chart:','Catatan analisis');if(text?.trim()){this.add({type:'text',a:p,b:p,text:text.slice(0,160)});this.onToast('Catatan ditambahkan')};this.setTool('pointer');return}if(['horizontal','vertical'].includes(this.tool)){this.add({type:this.tool,a:p,b:p});this.setTool('pointer');return}this.start=p;this.preview={type:this.tool,a:p,b:p};this.svg.setPointerCapture(e.pointerId);this.render()}
 move(e){if(!this.preview||this.tool==='pointer')return;const p=this.fromEvent(e);if(!p)return;this.preview.b=p;this.render()}
 up(e){if(!this.preview)return;const p=this.fromEvent(e);if(p)this.preview.b=p;const {a,b}=this.preview;this.add({...this.preview});this.preview=null;this.start=null;try{this.svg.releasePointerCapture(e.pointerId)}catch{}this.setTool('pointer');this.render()}
 add(item){this.undoStack.push(this.drawings.map(x=>({...x})));this.redoStack=[];this.drawings.push({...item,id:crypto?.randomUUID?.()||String(Date.now()+Math.random())});this.changed()}
 remove(id){if(!this.drawings.some(x=>x.id===id))return;this.undoStack.push(this.drawings.map(x=>({...x})));this.drawings=this.drawings.filter(x=>x.id!==id);this.selected=null;this.redoStack=[];this.changed()}
 clear(){if(!this.drawings.length)return;this.undoStack.push(this.drawings.map(x=>({...x})));this.drawings=[];this.redoStack=[];this.selected=null;this.changed()}
 undo(){if(!this.undoStack.length)return;this.redoStack.push(this.drawings.map(x=>({...x})));this.drawings=this.undoStack.pop();this.changed()}
 redo(){if(!this.redoStack.length)return;this.undoStack.push(this.drawings.map(x=>({...x})));this.drawings=this.redoStack.pop();this.changed()}
 load(items){this.drawings=Array.isArray(items)?items.filter(x=>x?.type&&x?.a&&x?.b).slice(0,500):[];this.undoStack=[];this.redoStack=[];this.selected=null;this.changed()}
 changed(){this.render();this.onChange?.()}
 render(){const w=this.stage.clientWidth,h=this.stage.clientHeight;if(w<10||h<10)return;this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.setAttribute('width',w);this.svg.setAttribute('height',h);if(this.hidden){this.svg.innerHTML='';return}
  const limitX=w-65;const parts=[];
  parts.push(`<defs><clipPath id="drawClip"><rect x="0" y="0" width="${limitX}" height="${h-24}"/></clipPath></defs><g clip-path="url(#drawClip)">`);
  for(const d of [...this.drawings,...(this.preview?[this.preview]:[])]){
   const ax=this.chart.logicalToCoordinate(d.a.logical),bx=this.chart.logicalToCoordinate(d.b.logical),ay=this.chart.priceToCoordinate(d.a.price),by=this.chart.priceToCoordinate(d.b.price);if([ax,bx,ay,by].some(x=>x===null||!Number.isFinite(x)))continue;
   const active=this.selected===d.id,blue=active?'#90b7ff':'#598eff',id=d.id?`data-drawing-id="${encode(d.id)}"`:'';
   if(d.type==='trend'||d.type==='ruler'){const color=d.type==='ruler'?'#f5bd66':blue;parts.push(`<g ${id}><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="${active?2.6:1.7}"/><circle cx="${ax}" cy="${ay}" r="3" fill="${color}"/><circle cx="${bx}" cy="${by}" r="3" fill="${color}"/><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="transparent" stroke-width="14" pointer-events="stroke"/></g>`);
    if(d.type==='ruler')parts.push(`<text x="${(ax+bx)/2+8}" y="${(ay+by)/2-8}" fill="#f4d08c" font-size="11">${(100*(d.b.price/d.a.price-1)).toFixed(2)}%</text>`);
   }else if(d.type==='horizontal'){parts.push(`<g ${id}><line x1="0" x2="${limitX}" y1="${ay}" y2="${ay}" stroke="${blue}" stroke-width="1.4" stroke-dasharray="6 4"/><rect x="0" y="${ay-6}" width="${limitX}" height="12" fill="transparent" pointer-events="all"/></g>`);
   }else if(d.type==='vertical'){parts.push(`<g ${id}><line x1="${ax}" x2="${ax}" y1="0" y2="${h-24}" stroke="${blue}" stroke-width="1.4" stroke-dasharray="6 4"/><rect x="${ax-6}" y="0" width="12" height="${h-24}" fill="transparent" pointer-events="all"/></g>`);
   }else if(d.type==='rectangle'){const x=Math.min(ax,bx),y=Math.min(ay,by),ww=Math.abs(bx-ax)||1,hh=Math.abs(by-ay)||1;parts.push(`<g ${id}><rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="#547df32c" stroke="${blue}" stroke-width="1.5" pointer-events="all"/></g>`);
   }else if(d.type==='fibo'){const x1=Math.min(ax,bx),x2=Math.max(ax,bx),width=Math.max(30,x2-x1);parts.push(`<g ${id}>`);for(const lv of fibLevels){const yy=ay+(by-ay)*lv;parts.push(`<line x1="${x1}" y1="${yy}" x2="${x1+width}" y2="${yy}" stroke="${lv===.618?'#f5b65a':'#73a2ff'}" stroke-width="1" pointer-events="stroke"/><text x="${x1+3}" y="${yy-3}" fill="#a6b7cf" font-size="10">${lv}</text>`)}parts.push(`<rect x="${x1}" y="${Math.min(ay,by)}" width="${width}" height="${Math.abs(by-ay)}" fill="transparent" pointer-events="all"/></g>`);
   }else if(d.type==='text'){parts.push(`<text ${id} x="${ax+5}" y="${ay}" fill="#ffcf8b" font-family="Arial,sans-serif" font-size="13" font-weight="600" pointer-events="all">${encode(d.text||'Note')}</text>`);
   }else if(d.type==='long'||d.type==='short'){const x=Math.min(ax,bx),width=Math.max(22,Math.abs(bx-ax)),entryY=ay,dist=Math.max(10,Math.abs(by-ay)),takeY=d.type==='long'?entryY-dist:entryY+dist,stopY=d.type==='long'?entryY+dist/2:entryY-dist/2;
    parts.push(`<g ${id}><rect x="${x}" y="${Math.min(entryY,takeY)}" width="${width}" height="${dist}" fill="#09a98031" stroke="#18bc92" stroke-width="1" pointer-events="all"/><rect x="${x}" y="${Math.min(entryY,stopY)}" width="${width}" height="${dist/2}" fill="#ec586535" stroke="#ef5c73" stroke-width="1" pointer-events="all"/><line x1="${x}" x2="${x+width}" y1="${entryY}" y2="${entryY}" stroke="#c2cde0" stroke-dasharray="4 2"/><text x="${x+4}" y="${Math.min(entryY,takeY)+12}" fill="#72e8c6" font-size="10">TP / RR 2:1</text><text x="${x+4}" y="${Math.max(entryY,stopY)-5}" fill="#ffa0ae" font-size="10">SL</text></g>`);
   }
  }
  parts.push('</g>');this.svg.innerHTML=parts.join('');
 }
}
