// Tradingwise drawing model. All coordinates are native provider price + UTC time.
export const TOOL_GROUPS = [
 ['Kursor',[['pointer','Kursor / pilih','i-pointer',0],['eraser','Penghapus objek','i-trash',0]]],
 ['Trend & level',[['trend','Trend line','i-trend',2],['ray','Ray','i-trend',2],['extended','Extended line','i-trend',2],['arrow','Arrow line','i-trend',2],['horizontal','Horizontal line','i-horizontal',1],['horizontalRay','Horizontal ray','i-horizontal',1],['vertical','Vertical line','i-vertical',1],['crossline','Cross line','i-compare',1],['channel','Parallel channel','i-trend',3]]],
 ['Fibonacci',[['fibo','Fib retracement','i-fibo',2],['fibExtension','Trend-based Fib extension','i-fibo',3]]],
 ['Bentuk & anotasi',[['rectangle','Rectangle / zona','i-rectangle',2],['ellipse','Ellipse','i-rectangle',2],['triangle','Triangle','i-rectangle',3],['brush','Brush','i-trend',2],['highlighter','Highlighter','i-trend',2],['text','Text / catatan','i-text',1],['priceLabel','Price label','i-text',1]]],
 ['Risk & measurement',[['long','Long position','i-trend',2],['short','Short position','i-trend',2],['ruler','Date & price range','i-ruler',2],['priceRange','Price range','i-ruler',2],['dateRange','Date range','i-ruler',2]]],
 ['SMC / ICT manual',[['obZone','Order block zone','i-rectangle',2],['fvgZone','Fair value gap zone','i-rectangle',2],['liquidity','Liquidity level','i-horizontal',1]]],
 ["Trend lanjutan",[["infoLine","Info line","i-trend",2],["trendAngle","Trend angle","i-trend",2],["regression","Regression trend","i-trend",2],["flatChannel","Flat top/bottom channel","i-trend",3],["disjointChannel","Disjoint channel","i-trend",4],["pitchfork","Pitchfork","i-trend",3],["schiffPitchfork","Schiff pitchfork","i-trend",3],["modifiedSchiff","Modified Schiff pitchfork","i-trend",3],["insidePitchfork","Inside pitchfork","i-trend",3]]],
 ["Fibonacci & Gann lanjutan",[["fibChannel","Fib channel","i-fibo",3],["fibTime","Fib time zone","i-fibo",2],["fibFan","Fib speed resistance fan","i-fibo",2],["fibTrendTime","Trend-based Fib time","i-fibo",3],["fibCircle","Fib circles","i-fibo",2],["fibArc","Fib arcs","i-fibo",2],["fibWedge","Fib wedge","i-fibo",3],["gannBox","Gann box (normalized grid)","i-grid",2],["gannFan","Gann fan (anchor-relative)","i-fibo",2]]],
 ["Motif manual",[["xabcd","XABCD pattern","i-trend",5],["cypher","Cypher pattern","i-trend",5],["headShoulders","Head and shoulders","i-trend",7],["abcd","ABCD pattern","i-trend",4],["trianglePattern","Triangle pattern","i-trend",3],["threeDrives","Three drives","i-trend",6],["elliottImpulse","Elliott impulse wave","i-trend",6],["elliottCorrection","Elliott corrective wave","i-trend",4],["elliottTriangle","Elliott triangle wave","i-trend",6],["elliottDouble","Elliott double combination","i-trend",4],["elliottTriple","Elliott triple combination","i-trend",6],["cycleLines","Cycle lines","i-vertical",2],["timeCycles","Time cycles","i-vertical",2],["sineWave","Sine wave","i-trend",2]]],
 ["Proyeksi",[["forecast","Forecast (manual)","i-trend",2],["sector","Sector","i-rectangle",3],["anchoredVwap","Anchored VWAP","i-trend",1],["fixedVolume","Fixed range volume profile (estimated)","i-grid",2],["anchoredVolume","Anchored volume profile (estimated)","i-grid",1],["datePriceRange","Date and price range","i-ruler",2]]],
 ["Bentuk lanjutan",[["arrowMarker","Arrow marker","i-trend",2],["arrowUp","Up arrow","i-trend",1],["arrowDown","Down arrow","i-trend",1],["rotatedRectangle","Rotated rectangle","i-rectangle",3],["path","Path","i-trend",2],["circle","Circle","i-rectangle",2],["polyline","Polyline","i-trend",2],["arc","Arc (quadratic)","i-trend",3],["curve","Curve (quadratic)","i-trend",3],["doubleCurve","Double curve","i-trend",5]]],
 ["Anotasi lanjutan",[["note","Note","i-text",1],["priceNote","Price note","i-text",1],["pin","Pin","i-text",1],["label","Label","i-text",1],["comment","Comment","i-text",1],["signpost","Signpost","i-text",1],["flag","Flag","i-text",1],["idea","Idea (local note)","i-text",1]]],
 ["Visual lokal",[["emoji","Emoji","i-text",1],["sticker","Sticker (local glyph)","i-text",1],["visualIcon","Icon (local glyph)","i-text",1]]]
];
export const POINT_KEYS=['a','b','c','d','e','f','g'];
export const isVariablePath=t=>t==='path'||t==='polyline';
export const MAX_PATH_POINTS=128;
export const TOOL_CATALOG=Object.fromEntries(TOOL_GROUPS.flatMap(([group,tools])=>tools.map(([id,label,icon,points])=>[id,{id,label,icon,points,group}])));
export const TOOL_IDS=Object.keys(TOOL_CATALOG).filter(id=>TOOL_CATALOG[id].points>0);
export const DEFAULT_FIB=[0,.236,.382,.5,.618,.705,.786,1];
export const DEFAULT_EXTENSION=[0,.618,1,1.272,1.618,2,2.618];
export function clone(value){return JSON.parse(JSON.stringify(value))}
const number=(x,fallback=0)=>Number.isFinite(Number(x))&&x!==null&&x!==''?Number(x):fallback;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const hex=(s,fallback)=>typeof s==='string'&&/^#[a-f0-9]{6}$/i.test(s)?s:fallback;
const valid=p=>p&&Number.isFinite(p.price)&&Math.abs(p.price)<=1e15&&Number.isFinite(p.logical)&&Math.abs(p.logical)<=1e8;
export function stepSeconds(candles){const n=candles.length;if(n<2)return 60;const a=[];for(let i=Math.max(1,n-10);i<n;i++)if(candles[i].time>candles[i-1].time)a.push(candles[i].time-candles[i-1].time);a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)]||60}
export function timeAt(candles,logical){
 const n=candles.length;if(!n)return null;
 if(logical<=0)return candles[0].time+logical*stepSeconds(candles);
 if(logical>=n-1)return candles[n-1].time+(logical-n+1)*stepSeconds(candles);
 const i=Math.floor(logical);return candles[i].time+(candles[i+1].time-candles[i].time)*(logical-i);
}
export function logicalAt(candles,time,fallback=0){
 const n=candles.length;if(!n||!Number.isFinite(time))return fallback;
 if(time<=candles[0].time)return (time-candles[0].time)/stepSeconds(candles);
 if(time>=candles[n-1].time)return n-1+(time-candles[n-1].time)/stepSeconds(candles);
 let l=0,r=n-1;while(r-l>1){const m=(r+l)>>1;if(candles[m].time<=time)l=m;else r=m}
 return l+(time-candles[l].time)/(candles[r].time-candles[l].time);
}
export function anchor(candles,logical,price){return {logical,price,time:timeAt(candles,logical)}}
export function resolveAnchor(candles,p){return {...p,logical:logicalAt(candles,p.time,p.logical)}}
export function normalizeAnchor(candles,p){
 if(!valid(p))return null;
 return {logical:logicalAt(candles,p.time,p.logical),price:p.price,time:Number.isFinite(p.time)?p.time:timeAt(candles,p.logical)};
}
export function normalizeStyle(type,style={}){
 if(!style||typeof style!=='object')style={};
 const zone=type==='obZone'?'#a68afb':type==='fvgZone'?'#20b9a3':type==='liquidity'?'#e5b34d':'#598eff';
 return {color:hex(style.color,zone),fill:hex(style.fill,zone),width:clamp(number(style.width,type==='highlighter'?12:2),1,20),opacity:clamp(number(style.opacity,type==='highlighter'?.28:.14),0,1),dash:['solid','dashed','dotted'].includes(style.dash)?style.dash:'solid',extend:style.extend===true,extendLeft:style.extendLeft===true};
}
export function normalizeLevels(levels,type='fibo'){
 const defaults=type==='fibExtension'?DEFAULT_EXTENSION:DEFAULT_FIB;
 if(!Array.isArray(levels))return [...defaults];
 const list=[...new Set(levels.filter(x=>typeof x==='number'&&Number.isFinite(x)&&x>=-10&&x<=20))].sort((a,b)=>a-b).slice(0,24);
 return list.length?list:[...defaults];
}
export function normalizeRisk(risk={}){
 if(!risk||typeof risk!=='object')risk={};
 return {balance:clamp(number(risk.balance,1000),0,1e12),percent:clamp(number(risk.percent,1),0,100),contract:clamp(number(risk.contract,1),.00000001,1e12)};
}
export function seedPosition(type,a,b,candles){
 const sign=type==='long'?1:-1,dist=Math.max(Math.abs(b.price-a.price),Math.abs(a.price)*.001,1e-8);
 const target={...b,price:a.price+sign*dist};
 const stop={...b,price:a.price-sign*dist/2};
 return {b:target,c:stop};
}
export function positionStats(d){
 if(!d.a||!d.b||!d.c)return null;
 const direction=d.type==='long'?1:-1,reward=(d.b.price-d.a.price)*direction,risk=(d.a.price-d.c.price)*direction;
 if(!(reward>0&&risk>0))return null;
 const cfg=normalizeRisk(d.risk),budget=cfg.balance*cfg.percent/100;
 return {risk,reward,rr:reward/risk,budget,qty:budget/(risk*cfg.contract),targetPnL:budget*reward/risk};
}
export function normalizeDrawing(d,candles=[]){
 if(!d||!TOOL_IDS.includes(d.type))return null;
 const a=normalizeAnchor(candles,d.a),b=normalizeAnchor(candles,d.b||d.a);if(!a||!b)return null;
 const out={id:String(d.id||globalThis.crypto?.randomUUID?.()||Date.now()+Math.random()).slice(0,80),type:d.type,a,b,style:normalizeStyle(d.type,d.style),text:String(d.text??'').slice(0,200),locked:d.locked===true,hidden:d.hidden===true};
 for(const k of POINT_KEYS.slice(2,TOOL_CATALOG[d.type].points)){out[k]=normalizeAnchor(candles,d[k]);if(!out[k])return null}
 if(['long','short'].includes(d.type)){
  out.risk=normalizeRisk(d.risk);out.c=normalizeAnchor(candles,d.c);
  if(!out.c){Object.assign(out,seedPosition(d.type,a,b,candles))}
  if(!positionStats(out))return null;
 }
 if(['fibo','fibExtension'].includes(d.type)){out.levels=normalizeLevels(d.levels,d.type);out.reverse=d.reverse===true;}
 if(isVariablePath(d.type)){
  const raw=Array.isArray(d.points)?d.points:POINT_KEYS.map(k=>d[k]).filter(Boolean);
  if(raw.length<2||raw.length>MAX_PATH_POINTS)return null;
  out.points=raw.map(p=>normalizeAnchor(candles,p));if(out.points.some(p=>!p))return null;
  out.a=out.points[0];out.b=out.points.at(-1);out.closed=d.type==='polyline'&&d.closed===true&&out.points.length>=3;
 }
 if(['brush','highlighter'].includes(d.type)){
  out.points=(Array.isArray(d.points)?d.points:[a,b]).slice(0,600).map(p=>normalizeAnchor(candles,p)).filter(Boolean);
  if(out.points.length<2)return null;
  out.a=out.points[0];out.b=out.points.at(-1);
 }
 return out;
}
export function shiftDrawing(d,candles,deltaLogical,deltaPrice){
 const out=clone(d);
 const move=p=>{const l=logicalAt(candles,p.time,p.logical)+deltaLogical;return anchor(candles,l,p.price+deltaPrice)};
 for(const k of POINT_KEYS)if(out[k])out[k]=move(out[k]);
 if(out.points)out.points=out.points.map(move);
 return out;
}
export function rangeStats(d,candles){
 const a=resolveAnchor(candles,d.a),b=resolveAnchor(candles,d.b),diff=b.price-a.price;
 return {diff,percent:a.price?diff/a.price*100:null,bars:Math.abs(Math.round(b.logical-a.logical)),seconds:Math.abs((b.time??timeAt(candles,b.logical)??0)-(a.time??timeAt(candles,a.logical)??0))};
}
export function fibPrices(d){
 const base=d.type==='fibExtension'?d.c?.price:d.a.price;if(!Number.isFinite(base))return [];
 const span=d.b.price-d.a.price;return normalizeLevels(d.levels,d.type).map(level=>({level,price:d.reverse?(d.type==='fibExtension'?base-span*level:d.b.price-span*level):base+span*level}));
}
// Clip ray or infinite line to the plot rectangle, not the price/time axes.
export function clipLine(a,b,w,h,mode='segment'){
 const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)+Math.abs(dy)<1e-9)return null;
 let lo=mode==='extended'?-Infinity:0,hi=mode==='segment'?1:Infinity;
 for(const [origin,delta,max] of [[a.x,dx,w],[a.y,dy,h]]){
  if(Math.abs(delta)<1e-9){if(origin<0||origin>max)return null;continue}
  const t1=(0-origin)/delta,t2=(max-origin)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
 }
 return lo<=hi&&Number.isFinite(lo)&&Number.isFinite(hi)?[{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}]:null;
}
