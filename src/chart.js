import {displayNum} from './market.js';
const $=id=>document.getElementById(id);
const themes={dark:{background:'#090b0e',grid:'#1c2026',minor:'#171a20',text:'#959ba7',up:'#089981',down:'#f23645',line:'#5580f6',cursor:'#8d9cbd'},light:{background:'#ffffff',grid:'#eff2f6',minor:'#f4f6f9',text:'#7b8698',up:'#079d81',down:'#e75267',line:'#416def',cursor:'#a0aabc'}};
export class ChartEngine{
 constructor(stage,{getSymbol,onMove}){
  this.stage=stage;this.getSymbol=getSymbol;this.onMove=onMove;this.candles=[];this.lines=[];this.type='candles';this.theme='dark';this.preferences={grid:true,crosshair:true,lastPrice:true,barSpacing:8,rightOffset:7,priceScale:'normal',upColor:'#089981',downColor:'#f23645'};this.isLW=!!window.LightweightCharts?.createChart;
  this.engine=this.isLW?new LWChart(stage,this):new CanvasChart(stage,this);
  this.engine.init();
 }
 setCandles(candles,{fit=true}={}){this.candles=candles;this.engine.setCandles(candles,fit);}
 setLines(lines){this.lines=lines;this.engine.setLines(lines)}
 setType(type){this.type=type;this.engine.setType(type)}
 setTheme(theme){this.theme=theme;this.engine.setTheme(theme);this.engine.setPreferences?.(this.preferences)}
 setPreferences(prefs){this.preferences={...this.preferences,...prefs};this.engine.setPreferences?.(this.preferences)}
 coordinateToLogical(x){return this.engine.coordinateToLogical(x)}
 logicalToCoordinate(i){return this.engine.logicalToCoordinate(i)}
 coordinateToPrice(y){return this.engine.coordinateToPrice(y)}
 priceToCoordinate(p){return this.engine.priceToCoordinate(p)}
 fit(){this.engine.fit()}
 showLast(count){this.engine.showLast(count)}
 resize(){this.engine.resize()}
 screenshot(){return this.engine.screenshot()}
 destroy(){this.engine.destroy()}
}
class LWChart{
 constructor(stage,outer){this.stage=stage;this.outer=outer;this.host=$('lightweightHost');this.container=$('fallbackCanvas');this.series=[];}
 init(){
  const L=window.LightweightCharts,t=themes[this.outer.theme];this.container.style.display='none';this.host.style.display='block';
  this.chart=L.createChart(this.host,{autoSize:true,layout:{background:{type:'solid',color:t.background},textColor:t.text,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",fontSize:11},grid:{vertLines:{color:t.grid},horzLines:{color:t.grid}},rightPriceScale:{borderColor:'#303a4b',scaleMargins:{top:.10,bottom:.06}},timeScale:{borderColor:'#303a4b',timeVisible:true,secondsVisible:false,rightOffset:7,barSpacing:8},crosshair:{mode:L.CrosshairMode?.Normal??0,vertLine:{color:'#59677e',style:2,labelBackgroundColor:'#526181'},horzLine:{color:'#59677e',style:2,labelBackgroundColor:'#526181'}},handleScroll:true,handleScale:true});
  this.main=this.chart.addSeries(L.CandlestickSeries,{upColor:t.up,downColor:t.down,borderVisible:false,wickUpColor:t.up,wickDownColor:t.down,priceLineVisible:true});
  this.chart.subscribeCrosshairMove(p=>{if(!p?.time){this.outer.onMove?.(null);return}const bar=this.outer.candles.find(c=>c.time===p.time);this.outer.onMove?.(bar||null)});
  this.chart.timeScale().subscribeVisibleLogicalRangeChange(()=>this.onVisible?.());
 }
 setCandles(candles,fit){const d=candles.map(({time,open,high,low,close})=>({time,open,high,low,close}));this.main.setData(d);if(fit)this.showLast(140);}
 setLines(lines){
  const L=window.LightweightCharts;
  for(const s of this.series){try{this.chart.removeSeries(s)}catch{}}
  this.series=[];let rsiPane=null,macdPane=null;
  for(const line of lines){
   try{
    let p=0,opts={color:line.color,lineWidth:2,priceLineVisible:false,lastValueVisible:line.pane!=='volume',crosshairMarkerVisible:false};
    if(line.pane==='rsi'){if(rsiPane===null)rsiPane=this.chart.panes().length;rsiPane=Math.min(rsiPane,this.chart.panes().length);p=rsiPane;opts.priceFormat={type:'price',precision:2,minMove:.01};}
    if(line.pane==='macd'){if(macdPane===null)macdPane=this.chart.panes().length;macdPane=Math.min(macdPane,this.chart.panes().length);p=macdPane;opts.priceFormat={type:'price',precision:3,minMove:.001};}
    if(line.pane==='volume'){opts={priceScaleId:'volume',priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'volume'},color:'#566e92'};}
    const kind=line.kind==='histogram'?L.HistogramSeries:L.LineSeries;
    const series=this.chart.addSeries(kind,opts,p);
    if(line.pane==='volume'){series.priceScale().applyOptions({scaleMargins:{top:.78,bottom:0},visible:false});}
    series.setData(line.values.map(x=>({...x,...(line.kind==='histogram'&&line.pane==='macd'?{color:x.value>=0?'#14a38d':'#e05c71'}:{})})));
    this.series.push(series);
   }catch(e){console.warn('Indicator render:',line.key,e)}
  }
  try{if(this.chart.panes().length>1){for(let i=1;i<this.chart.panes().length;i++)this.chart.panes()[i].setHeight(100)}}catch{}
 }
 setType(type){const L=window.LightweightCharts;try{this.chart.removeSeries(this.main)}catch{}this.main=this.chart.addSeries(type==='line'?L.LineSeries:type==='area'?L.AreaSeries:L.CandlestickSeries,type==='candles'?{upColor:themes[this.outer.theme].up,downColor:themes[this.outer.theme].down,borderVisible:false,wickUpColor:themes[this.outer.theme].up,wickDownColor:themes[this.outer.theme].down}:{color:'#6e97fa',lineColor:'#628dfc',topColor:'#4167b075',bottomColor:'#42517a10',lineWidth:2});this.setCandles(this.outer.candles,false);this.setPreferences(this.outer.preferences);}
 setTheme(theme){const t=themes[theme];this.chart.applyOptions({layout:{background:{type:'solid',color:t.background},textColor:t.text},grid:{vertLines:{color:t.grid},horzLines:{color:t.grid}},rightPriceScale:{borderColor:t.grid},timeScale:{borderColor:t.grid}});if(this.outer.type==='candles')this.main.applyOptions({upColor:t.up,downColor:t.down,wickUpColor:t.up,wickDownColor:t.down});}
 setPreferences(p){const t=themes[this.outer.theme],L=window.LightweightCharts;this.chart.applyOptions({grid:{vertLines:{visible:p.grid,color:t.grid},horzLines:{visible:p.grid,color:t.grid}},crosshair:{vertLine:{visible:p.crosshair},horzLine:{visible:p.crosshair}},timeScale:{barSpacing:p.barSpacing,rightOffset:p.rightOffset},rightPriceScale:{mode:({normal:L.PriceScaleMode?.Normal??0,logarithmic:L.PriceScaleMode?.Logarithmic??1,percentage:L.PriceScaleMode?.Percentage??2})[p.priceScale]??0}});this.main.applyOptions({priceLineVisible:p.lastPrice,lastValueVisible:p.lastPrice,...(this.outer.type==='candles'?{upColor:p.upColor,downColor:p.downColor,wickUpColor:p.upColor,wickDownColor:p.downColor}:{})});}
 coordinateToLogical(x){return this.chart.timeScale().coordinateToLogical(x)}
 logicalToCoordinate(i){return this.chart.timeScale().logicalToCoordinate(i)}
 coordinateToPrice(y){return this.main.coordinateToPrice(y)}
 priceToCoordinate(p){return this.main.priceToCoordinate(p)}
 fit(){this.showLast(140)}
 showLast(count){if(!this.outer.candles.length)return;const n=this.outer.candles.length;this.chart.timeScale().setVisibleLogicalRange({from:Math.max(-5,n-count),to:n+5});}
 resize(){}screenshot(){return this.chart.takeScreenshot().toDataURL('image/png')}
 destroy(){this.chart.remove()}
}
class CanvasChart{
 constructor(stage,outer){this.stage=stage;this.outer=outer;this.canvas=$('fallbackCanvas');this.ctx=this.canvas.getContext('2d');this.first=0;this.step=8;this.dpr=1;this.marginLeft=4;this.marginRight=74;this.marginTop=70;this.marginBottom=26;this.mainHeight=0;this.scaleMin=0;this.scaleMax=1;this.dragging=null;this.mouse=null;this.pending=false;this.theme='dark'}
 init(){this.canvas.style.display='block';$('lightweightHost').style.display='none';this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.stage);this.install();}
 install(){const c=this.canvas;
  c.addEventListener('mousemove',e=>{const p=this.pointer(e);this.mouse=p;if(this.dragging){this.first=Math.max(-1000,Math.min(this.outer.candles.length+100,this.dragging.first+(this.dragging.x-p.x)/this.step));}else{const idx=Math.round(this.coordinateToLogical(p.x));this.outer.onMove?.(this.outer.candles[idx]||null);}this.render()});
  c.addEventListener('mouseleave',()=>{this.mouse=null;this.outer.onMove?.(null);this.render()});
  c.addEventListener('mousedown',e=>{if(e.button!==0||this.stage.classList.contains('drawing-mode'))return;this.dragging={x:this.pointer(e).x,first:this.first};c.style.cursor='grabbing'});
  window.addEventListener('mouseup',()=>{this.dragging=null;c.style.cursor='crosshair'});
  c.addEventListener('wheel',e=>{e.preventDefault();const x=this.pointer(e).x,anchor=this.coordinateToLogical(x);if(e.ctrlKey||e.metaKey||Math.abs(e.deltaY)>Math.abs(e.deltaX)){const m=e.deltaY>0?.88:1.14;this.step=Math.max(3,Math.min(38,this.step*m));this.first=anchor-(x-this.marginLeft)/this.step;}else this.first+=e.deltaX/this.step;this.render()},{passive:false});
  c.addEventListener('dblclick',()=>this.fit());
 }
 pointer(e){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 resize(){const r=this.stage.getBoundingClientRect();this.w=Math.max(100,r.width);this.h=Math.max(90,r.height);this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.canvas.style.width=this.w+'px';this.canvas.style.height=this.h+'px';this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.render()}
 setCandles(candles,fit){if(fit)this.fit();else this.render()}
 setLines(){this.render()}
 setType(){this.render()}
 setTheme(theme){this.theme=theme;this.render()}
 setPreferences(){this.render()}
 fit(){const n=this.outer.candles.length;const plotWidth=Math.max(50,this.w-this.marginRight-this.marginLeft);this.step=Math.max(3,Math.min(13,plotWidth/100));this.first=n-plotWidth/this.step+4;this.render()}
 showLast(count){const width=this.w-this.marginRight-this.marginLeft;this.step=Math.max(3,Math.min(30,width/count));this.first=this.outer.candles.length-count;this.render()}
 coordinateToLogical(x){return this.first+(x-this.marginLeft)/this.step}
 logicalToCoordinate(i){return this.marginLeft+(i-this.first)*this.step+this.step*.5}
 coordinateToPrice(y){const h=Math.max(20,this.mainHeight-this.marginTop);return this.scaleMax-(y-this.marginTop)/h*(this.scaleMax-this.scaleMin)}
 priceToCoordinate(p){const h=Math.max(20,this.mainHeight-this.marginTop);return this.marginTop+(this.scaleMax-p)/(this.scaleMax-this.scaleMin)*h}
 render(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.draw();this.onVisible?.()})}
 draw(){const {w,h,ctx}=this; if(!w||!h)return;const t=themes[this.theme],cs=this.outer.candles,cols=Math.ceil((w-this.marginRight)/this.step)+3,start=Math.max(0,Math.floor(this.first)-2),end=Math.min(cs.length,start+cols+5);
  ctx.clearRect(0,0,w,h);ctx.fillStyle=t.background;ctx.fillRect(0,0,w,h);
  const panels=[];if(this.outer.lines.some(l=>l.pane==='rsi'))panels.push('rsi');if(this.outer.lines.some(l=>l.pane==='macd'))panels.push('macd');const subH=panels.length?Math.min(105,Math.max(66,(h-200)/panels.length)):0;
  this.mainHeight=h-this.marginBottom-subH*panels.length-6*panels.length;
  this.mainHeight=Math.max(105,this.mainHeight);
  const vals=cs.slice(start,end);let lo=Math.min(...vals.map(x=>x.low)),hi=Math.max(...vals.map(x=>x.high));if(!Number.isFinite(lo)){lo=0;hi=100}for(const line of this.outer.lines.filter(l=>l.pane==='main'))for(const p of line.values){if(p.time>=cs[start]?.time&&p.time<=cs[end-1]?.time){lo=Math.min(lo,p.value);hi=Math.max(hi,p.value)}}const margin=(hi-lo)*.12||hi*.008||1;this.scaleMin=lo-margin;this.scaleMax=hi+margin;
  ctx.lineWidth=1;ctx.font='11px -apple-system,Segoe UI,Arial';ctx.textBaseline='middle';
  for(let row=0;row<6;row++){const y=this.marginTop+(this.mainHeight-this.marginTop)*row/5;if(this.outer.preferences.grid){ctx.strokeStyle=t.grid;ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(w-this.marginRight,y+.5);ctx.stroke()}const val=this.coordinateToPrice(y);ctx.fillStyle=t.text;ctx.fillText(displayNum(val,this.outer.getSymbol()),w-this.marginRight+7,y)}
  let ticks=Math.max(5,Math.ceil(105/this.step));for(let i=Math.floor(this.first/ticks)*ticks;i<end;i+=ticks){if(i<0)continue;const x=this.logicalToCoordinate(i);if(x<0||x>w-this.marginRight)continue;if(this.outer.preferences.grid){ctx.strokeStyle=t.minor;ctx.beginPath();ctx.moveTo(Math.round(x)+.5,this.marginTop);ctx.lineTo(x,h-this.marginBottom);ctx.stroke()}if(cs[i]){const d=new Date(cs[i].time*1000);ctx.fillStyle=t.text;ctx.textAlign='center';ctx.fillText(`${String(d.getUTCDate()).padStart(2,'0')} ${d.toLocaleString('en',{month:'short',timeZone:'UTC'})}`,x,h-12);ctx.textAlign='left'}}
  const volumeOn=this.outer.lines.some(l=>l.pane==='volume');if(volumeOn&&vals.length){const maxVol=Math.max(...vals.map(x=>x.volume||0),1);for(let i=start;i<end;i++){const d=cs[i];const x=this.logicalToCoordinate(i);if(x<0||x>w-this.marginRight)continue;const height=(d.volume||0)/maxVol*Math.min(90,this.mainHeight*.22);ctx.fillStyle=d.close>=d.open?'#12857076':'#bb4e6070';ctx.fillRect(x-Math.max(1,this.step*.36),this.mainHeight-height,Math.max(1.5,this.step*.72),height)}}
  if(this.outer.type==='candles'){
   for(let i=start;i<end;i++){const d=cs[i],x=this.logicalToCoordinate(i);if(x<0||x>=w-this.marginRight)continue;const up=d.close>=d.open;ctx.strokeStyle=ctx.fillStyle=up?this.outer.preferences.upColor:this.outer.preferences.downColor;ctx.lineWidth=Math.max(1,Math.min(1.3,this.step*.12));const hy=this.priceToCoordinate(d.high),ly=this.priceToCoordinate(d.low),oy=this.priceToCoordinate(d.open),cy=this.priceToCoordinate(d.close);ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x,ly);ctx.stroke();const width=Math.max(1,Math.min(22,this.step*.72));ctx.fillRect(x-width/2,Math.min(oy,cy),width,Math.max(1.1,Math.abs(oy-cy)))}
  }else{
   ctx.strokeStyle=t.line;ctx.lineWidth=2;ctx.beginPath();let started=false;for(let i=start;i<end;i++){const d=cs[i],x=this.logicalToCoordinate(i),y=this.priceToCoordinate(d.close);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)}
   if(this.outer.type==='area'){const firstX=this.logicalToCoordinate(start),lastX=this.logicalToCoordinate(end-1);const fill=ctx.createLinearGradient(0,this.marginTop,0,this.mainHeight);fill.addColorStop(0,'#527fff66');fill.addColorStop(1,'#527fff00');ctx.lineTo(lastX,this.mainHeight);ctx.lineTo(firstX,this.mainHeight);ctx.fillStyle=fill;ctx.fill();ctx.beginPath();for(let i=start;i<end;i++){const x=this.logicalToCoordinate(i),y=this.priceToCoordinate(cs[i].close);i===start?ctx.moveTo(x,y):ctx.lineTo(x,y)}}ctx.stroke()}
  const plotLine=(series,toY,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();let began=false;const timeToIdx=new Map();for(let i=start;i<end;i++)timeToIdx.set(cs[i].time,i);for(const pt of series){const idx=timeToIdx.get(pt.time);if(idx===undefined)continue;const x=this.logicalToCoordinate(idx),y=toY(pt.value);if(!Number.isFinite(y))continue;if(!began){ctx.moveTo(x,y);began=true}else ctx.lineTo(x,y)}if(began)ctx.stroke()};
  for(const line of this.outer.lines.filter(l=>l.pane==='main'&&l.values.length))plotLine(line.values,v=>this.priceToCoordinate(v),line.color,line.key.startsWith('bb')?1.2:1.7);
  if(cs.length){const last=cs[Math.max(0,Math.min(cs.length-1,end-1))];const lastY=this.priceToCoordinate(last.close);if(this.outer.preferences.lastPrice&&lastY>=0&&lastY<this.mainHeight){ctx.setLineDash([3,3]);ctx.strokeStyle=last.close>=last.open?this.outer.preferences.upColor:this.outer.preferences.downColor;ctx.beginPath();ctx.moveTo(0,lastY);ctx.lineTo(w-this.marginRight,lastY);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=last.close>=last.open?this.outer.preferences.upColor:this.outer.preferences.downColor;ctx.fillRect(w-this.marginRight,lastY-10,this.marginRight,20);ctx.fillStyle='#fff';ctx.font='bold 10px var(--mono),monospace';ctx.fillText(displayNum(last.close,this.outer.getSymbol()),w-this.marginRight+5,lastY)}}
  ctx.strokeStyle=t.grid;ctx.beginPath();ctx.moveTo(w-this.marginRight+.5,0);ctx.lineTo(w-this.marginRight+.5,h);ctx.moveTo(0,h-this.marginBottom+.5);ctx.lineTo(w,h-this.marginBottom+.5);ctx.stroke();
  panels.forEach((p,pidx)=>{const lines=this.outer.lines.filter(l=>l.pane===p);const y0=this.mainHeight+6+pidx*(subH+6),y1=Math.min(h-this.marginBottom,y0+subH);ctx.fillStyle=t.background;ctx.fillRect(0,y0,w,y1-y0);ctx.fillStyle=t.text;ctx.font='10px -apple-system,Segoe UI';ctx.fillText(p.toUpperCase(),8,y0+10);const points=lines.flatMap(l=>l.values.filter(x=>x.time>=cs[start]?.time&&x.time<=cs[end-1]?.time).map(v=>v.value));let low=p==='rsi'?0:Math.min(0,...points),high=p==='rsi'?100:Math.max(0,...points);if(!(high>low)){high=1;low=-1}const toY=v=>y0+12+(high-v)/(high-low)*(y1-y0-21);for(let g=1;g<=2;g++){const yy=y0+(y1-y0)*g/3;ctx.strokeStyle=t.grid;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w-this.marginRight,yy);ctx.stroke()}for(const line of lines){if(line.kind==='histogram'){for(const pt of line.values){if(pt.time<cs[start]?.time||pt.time>cs[end-1]?.time)continue;let idx=cs.findIndex(c=>c.time===pt.time);if(idx<0)continue;const x=this.logicalToCoordinate(idx),top=toY(Math.max(pt.value,0)),base=toY(0),bottom=toY(Math.min(pt.value,0));ctx.fillStyle=pt.value>=0?'#309f8d':'#c85965';ctx.fillRect(x-this.step*.32,top,Math.max(1,this.step*.64),Math.max(1,bottom-top));}}else plotLine(line.values,toY,line.color,1.5)}ctx.strokeStyle=t.grid;ctx.beginPath();ctx.moveTo(0,y1+.5);ctx.lineTo(w,y1+.5);ctx.stroke()});
  if(this.mouse&&this.outer.preferences.crosshair){const{x,y}=this.mouse;if(x>=0&&x<w-this.marginRight&&y>=0&&y<h-this.marginBottom){ctx.setLineDash([3,3]);ctx.strokeStyle=t.cursor;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h-this.marginBottom);if(y<this.mainHeight){ctx.moveTo(0,y);ctx.lineTo(w-this.marginRight,y)}ctx.stroke();ctx.setLineDash([]);if(y<this.mainHeight){ctx.fillStyle='#52627d';ctx.fillRect(w-this.marginRight,y-10,this.marginRight,20);ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.fillText(displayNum(this.coordinateToPrice(y),this.outer.getSymbol()),w-this.marginRight+3,y)}}}
 }
 screenshot(){return this.canvas.toDataURL('image/png')}
 destroy(){this.observer?.disconnect()}
}
