import {ANCHOR_KEYS,rangeStats,logicalAt} from './drawing-model.js';
export const annotationDefaults={note:'Catatan',priceNote:'Harga',pin:'Pin',label:'Label',comment:'Komentar',flag:'Flag',idea:'Ide',emoji:'🙂',sticker:'⭐',chartIcon:'♥'};
export function linearRegression(values){
 if(values.length<2||values.some(v=>!Number.isFinite(v)))return null;
 const count=values.length,meanX=(count-1)/2,meanY=values.reduce((a,b)=>a+b,0)/count;
 let xx=0,xy=0;for(let i=0;i<count;i++){xx+=(i-meanX)**2;xy+=(i-meanX)*(values[i]-meanY)}
 const slope=xy/xx,intercept=meanY-slope*meanX,sd=Math.sqrt(values.reduce((a,v,i)=>a+(v-intercept-slope*i)**2,0)/count);
 return {slope,intercept,sd};
}
export function anchoredVwap(candles,start){
 let volume=0,weighted=0;return candles.slice(Math.max(0,start)).map(bar=>{if(Number.isFinite(bar.volume)&&bar.volume>0){volume+=bar.volume;weighted+=(bar.high+bar.low+bar.close)/3*bar.volume}return {time:bar.time,price:volume>0?weighted/volume:null}});
}
export function renderExtraDrawing(ctx){
 const {d,a,b,c,point,line,label,rect,group,style,color,stroke,right,bottom,chart,xy,n,enc}=ctx,t=d.type;
 const points=ANCHOR_KEYS.filter(k=>d[k]).map(k=>point(d[k])).filter(Boolean);
 const poly=(ps,fill='none',opacity=0,closed=false)=>{if(ps.length<2)return;const tag=closed?'polygon':'polyline';group.push('<'+tag+' points="'+ps.map(xy).join(' ')+'" fill="'+fill+'" fill-opacity="'+opacity+'"'+stroke+' pointer-events="'+(closed?'all':'stroke')+'"/>');if(!closed)group.push('<polyline points="'+ps.map(xy).join(' ')+'" fill="none" stroke="transparent" stroke-width="16" pointer-events="stroke"/>')};
 const shapePath=(path,fill='none')=>group.push('<path d="'+path+'" fill="'+fill+'"'+stroke+' pointer-events="all"/>');
 const circle=(x,y,r)=>group.push('<circle cx="'+n(x)+'" cy="'+n(y)+'" r="'+n(Math.max(1,r))+'" fill="none"'+stroke+' pointer-events="stroke"/>');
 const length=Math.hypot(b.x-a.x,b.y-a.y);
 if(t==='infoLine'||t==='trendAngle'||t==='projection'){
  line(a,b);const q=rangeStats(d,chart.candles);
  if(t==='trendAngle'){line(a,{x:b.x,y:a.y},'opacity=".55"');label(a.x+4,a.y-8,(Math.atan2(a.y-b.y,b.x-a.x)*180/Math.PI).toFixed(1)+'° (view)')}
  else label(Math.min(a.x,b.x)+3,Math.min(a.y,b.y)-6,(t==='projection'?'Manual · ':'')+q.diff.toPrecision(5)+' · '+q.bars+' bars');
 }else if(t==='regression'){
  const from=Math.max(0,Math.min(chart.candles.length-1,Math.round(Math.min(logicalAt(chart.candles,d.a.time,d.a.logical),logicalAt(chart.candles,d.b.time,d.b.logical))))),to=Math.min(chart.candles.length-1,Math.round(Math.max(logicalAt(chart.candles,d.a.time,d.a.logical),logicalAt(chart.candles,d.b.time,d.b.logical))));
  const fit=linearRegression(chart.candles.slice(from,to+1).map(x=>x.close));if(fit){const x1=chart.logicalToCoordinate(from),x2=chart.logicalToCoordinate(to);for(const m of [-2,0,2]){const y1=chart.priceToCoordinate(fit.intercept+m*fit.sd),y2=chart.priceToCoordinate(fit.intercept+fit.slope*(to-from)+m*fit.sd);if([x1,x2,y1,y2].every(Number.isFinite))line({x:x1,y:y1},{x:x2,y:y2},m?'opacity=".7"':'')}label(x1+4,a.y,'Regression ±2σ')}else line(a,b,'opacity=".35"');
 }else if(['flatChannel','disjointChannel','fibChannel','pitchfork'].includes(t)){
  if(!c){line(a,b);return true}
  if(t==='pitchfork'){const mid={x:(b.x+c.x)/2,y:(b.y+c.y)/2},dx=mid.x-a.x,dy=mid.y-a.y;line(b,c,'opacity=".5"');for(const q of [a,b,c])line(q,{x:q.x+dx,y:q.y+dy},'','ray')}
  else if(t==='flatChannel'){line(a,{x:b.x,y:a.y});line({x:a.x,y:c.y},{x:b.x,y:c.y})}
  else{const dx=b.x-a.x,offset=c.y-(a.y+(Math.abs(dx)>.01?(b.y-a.y)*(c.x-a.x)/dx:0));for(const m of t==='fibChannel'?[0,.382,.618,1,1.618,2.618]:[0,1]){line({x:a.x,y:a.y+offset*m},{x:b.x,y:b.y+offset*m},'',t==='fibChannel'?'ray':'segment');if(t==='fibChannel')label(a.x+3,a.y+offset*m-3,String(m))}}
 }else if(t==='fibTime'||t==='cycleLines'){
  const dx=Math.abs(b.x-a.x);if(dx<2){line(a,b);return true}const levels=t==='fibTime'?[0,1,2,3,5,8,13,21,34]:Array.from({length:Math.min(50,Math.ceil(right/dx)+1)},(_,i)=>i);
  for(const level of levels){const x=a.x+dx*level;if(x<=right){line({x,y:0},{x,y:bottom});if(t==='fibTime')label(x+3,15,String(level))}}
 }else if(t==='fibFan'||t==='gannFan'){
  const levels=t==='fibFan'?[.382,.5,.618,1]:[.125,.25,.5,1,2,4,8];for(const level of levels){const end={x:b.x,y:a.y+(b.y-a.y)*level};line(a,end,'','ray');label(end.x+2,end.y-3,String(level))}
 }else if(t==='circle'||t==='fibCircle'){
  for(const m of t==='fibCircle'?[.236,.382,.5,.618,1,1.618,2.618]:[1])circle(a.x,a.y,length*m);
 }else if(t==='gannBox'){
  rect(a.x,a.y,b.x,b.y);const dx=b.x-a.x,dy=b.y-a.y;for(let i=1;i<4;i++){line({x:a.x+dx*i/4,y:a.y},{x:a.x+dx*i/4,y:b.y});line({x:a.x,y:a.y+dy*i/4},{x:b.x,y:a.y+dy*i/4})}line(a,b);line({x:a.x,y:b.y},{x:b.x,y:a.y});
 }else if(['xabcd','abcd','elliottImpulse','elliottCorrection','elliottTriangle','path','polyline'].includes(t)){
  const names={xabcd:['X','A','B','C','D'],abcd:['A','B','C','D'],elliottImpulse:['0','1','2','3','4','5'],elliottCorrection:['0','A','B','C'],elliottTriangle:['0','A','B','C','D','E']}[t];
  poly(points);if(names)points.forEach((p,i)=>label(p.x+4,p.y-6,names[i]||''));if(t==='path'&&points.length>1){const end=points.at(-1),prior=points.at(-2),ang=Math.atan2(end.y-prior.y,end.x-prior.x);poly([{x:end.x-9*Math.cos(ang-.5),y:end.y-9*Math.sin(ang-.5)},end,{x:end.x-9*Math.cos(ang+.5),y:end.y-9*Math.sin(ang+.5)}])}
 }else if(t==='sineLine'){
  const dx=Math.abs(b.x-a.x);if(dx<2){line(a,b);return true}const amp=b.y-a.y,ps=Array.from({length:Math.min(240,Math.ceil(Math.max(0,right-a.x)/3)+1)},(_,i)=>({x:a.x+i*3,y:a.y+amp*Math.sin((i*3/dx)*Math.PI/2)}));poly(ps);
 }else if(t==='sector'||t==='arc'||t==='curve'||t==='doubleCurve'){
  if(!c){line(a,b);return true}
  if(t==='sector'||t==='arc'){const rr=Math.max(1,length),angle=Math.atan2(c.y-a.y,c.x-a.x),end={x:a.x+rr*Math.cos(angle),y:a.y+rr*Math.sin(angle)};const cross=(b.x-a.x)*(end.y-a.y)-(b.y-a.y)*(end.x-a.x);shapePath((t==='sector'?'M '+xy(a)+' L ':'M ')+xy(b)+' A '+n(rr)+' '+n(rr)+' 0 0 '+(cross>=0?1:0)+' '+xy(end)+(t==='sector'?' Z':''),t==='sector'?style.fill+'33':'none')}
  else if(t==='doubleCurve'&&points.length>=4)shapePath('M '+xy(a)+' C '+xy(b)+' '+xy(c)+' '+xy(points[3]));
  else shapePath('M '+xy(a)+' Q '+xy(b)+' '+xy(c));
 }else if(t==='rotatedRect'){
  if(!c||length<1){line(a,b);return true}const ux=-(b.y-a.y)/length,uy=(b.x-a.x)/length,h=(c.x-a.x)*ux+(c.y-a.y)*uy;poly([a,b,{x:b.x+ux*h,y:b.y+uy*h},{x:a.x+ux*h,y:a.y+uy*h}],style.fill,style.opacity,true);
 }else if(t==='anchoredVwap'){
  const start=Math.max(0,Math.ceil(logicalAt(chart.candles,d.a.time,d.a.logical)));const vv=anchoredVwap(chart.candles,start).map((v,i)=>({x:chart.logicalToCoordinate(start+i),y:v.price===null?null:chart.priceToCoordinate(v.price)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(vv.length>1)poly(vv);else label(a.x+4,a.y-5,'VWAP: volume tidak tersedia');circle(a.x,a.y,4);
 }else if(t==='arrowUp'||t==='arrowDown'){
  const s=t==='arrowUp'?-1:1;poly([{x:a.x,y:a.y+13*s},{x:a.x+11,y:a.y-1*s},{x:a.x+4,y:a.y-1*s},{x:a.x+4,y:a.y-11*s},{x:a.x-4,y:a.y-11*s},{x:a.x-4,y:a.y-1*s},{x:a.x-11,y:a.y-1*s}],color,.65,true);
 }else if(Object.hasOwn(annotationDefaults,t)){
  const txt=t==='priceNote'?chart.formatPrice(d.a.price):d.text||annotationDefaults[t];if(t==='pin'||t==='flag'){line(a,{x:a.x,y:a.y-19});circle(a.x,a.y-21,5)}
  const visual=['emoji','sticker','chartIcon'].includes(t),size=visual?24:13;
  if(!visual&&['note','priceNote','label','comment','idea'].includes(t)){const width=Math.min(200,Math.max(46,txt.length*7+12));rect(a.x+3,a.y-25,a.x+3+width,a.y-5,style.fill,Math.max(.12,style.opacity))}
  group.push('<text x="'+n(a.x+7)+'" y="'+n(a.y-(visual?0:10))+'" font-size="'+size+'" fill="'+color+'" pointer-events="all">'+enc(txt)+'</text>');
 }else return false;
 return true;
}
