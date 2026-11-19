import {POINT_KEYS,isVariablePath,logicalAt,rangeStats} from './drawing-model.js';
export const NOTE_TYPES=['note','priceNote','label','comment','signpost','flag','pin','idea','emoji','sticker','visualIcon'];
const PATTERNS={xabcd:'XABCD',cypher:'XABCD',headShoulders:['LS','N1','H','N2','RS','N3','End'],abcd:'ABCD',trianglePattern:'ABC',threeDrives:['1','A','2','B','3','C'],elliottImpulse:['0','1','2','3','4','5'],elliottCorrection:['0','A','B','C'],elliottTriangle:['0','A','B','C','D','E'],elliottDouble:['0','W','X','Y'],elliottTriple:['0','W','X','Y','X','Z']};
const fib=[.236,.382,.5,.618,.786,1,1.618,2.618];
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const limits=(candles,a,b)=>{const start=Math.max(0,Math.ceil(logicalAt(candles,a.time,a.logical)));const end=Math.min(candles.length-1,Math.floor(b?logicalAt(candles,b.time,b.logical):candles.length-1));return [Math.min(start,end),Math.max(start,end)]};
export function regression(candles){
 const v=candles.map((b,i)=>({x:i,y:b.close})).filter(b=>Number.isFinite(b.y));if(v.length<2)return null;
 const count=v.length,x=v.reduce((s,b)=>s+b.x,0)/count,y=v.reduce((s,b)=>s+b.y,0)/count;
 const denom=v.reduce((s,b)=>s+(b.x-x)**2,0);if(!denom)return null;
 const slope=v.reduce((s,b)=>s+(b.x-x)*(b.y-y),0)/denom,intercept=y-slope*x;
 const sigma=Math.sqrt(v.reduce((s,b)=>s+(b.y-(intercept+slope*b.x))**2,0)/count);
 return {slope,intercept,sigma};
}
export function anchoredVWAP(candles){
 let pv=0,v=0;return candles.map(b=>{const volume=Number(b.volume),price=(b.high+b.low+b.close)/3;if(Number.isFinite(volume)&&volume>0&&Number.isFinite(price)){pv+=price*volume;v+=volume}return v>0?pv/v:null});
}
export function estimatedProfile(candles,bins=24){
 const bars=candles.filter(b=>Number.isFinite(b.low)&&Number.isFinite(b.high)&&Number.isFinite(b.close)&&b.high>=b.low&&Number.isFinite(b.volume)&&b.volume>0);
 if(!bars.length)return null;const lo=Math.min(...bars.map(b=>b.low)),hi=Math.max(...bars.map(b=>b.high));if(hi<=lo)return null;
 const dx=(hi-lo)/bins,values=Array(bins).fill(0);for(const b of bars){const i=Math.max(0,Math.min(bins-1,Math.floor(((b.high+b.low+b.close)/3-lo)/dx)));values[i]+=b.volume}
 return {lo,hi,dx,values};
}
export function renderAdvanced({d,a,b,c,right,bottom,line,label,rect,group,stroke,style,color,chart,point,n,xy,enc,round}){
 const t=d.type,points=(isVariablePath(t)&&Array.isArray(d.points)?d.points.map(point):POINT_KEYS.map(k=>d[k]&&point(d[k]))).filter(Boolean),polygon=(ps,fill=true)=>{if(ps.length<2)return;group.push('<'+(fill?'polygon':'polyline')+' points="'+ps.map(xy).join(' ')+'" fill="'+(fill?style.fill:'none')+'" fill-opacity="'+style.opacity+'"'+stroke+' pointer-events="'+(fill?'all':'stroke')+'"/>');if(!fill)for(let i=1;i<ps.length;i++)line(ps[i-1],ps[i])};
 const arrow=(a,b)=>{line(a,b);const ang=Math.atan2(b.y-a.y,b.x-a.x),r=12;polygon([b,{x:b.x-r*Math.cos(ang-.5),y:b.y-r*Math.sin(ang-.5)},{x:b.x-r*Math.cos(ang+.5),y:b.y-r*Math.sin(ang+.5)}])};
 const curve=(path)=>{group.push('<path d="'+path+'" fill="none"'+stroke+' pointer-events="stroke"/><path d="'+path+'" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke"/>')};
 const circle=(center,r)=>{if(r>0&&Number.isFinite(r))group.push('<circle cx="'+n(center.x)+'" cy="'+n(center.y)+'" r="'+n(r)+'" fill="none"'+stroke+' pointer-events="stroke"/>')};
 const text=(p,s,size=13)=>group.push('<text x="'+n(p.x+4)+'" y="'+n(p.y-5)+'" fill="'+color+'" font-size="'+size+'" font-weight="600" pointer-events="all">'+enc(s)+'</text>');
 if(t==='infoLine'||t==='trendAngle'||t==='forecast'){line(a,b);const r=rangeStats(d,chart.candles);if(t==='trendAngle'){line(a,{x:b.x,y:a.y},'opacity=".45"');label(b.x,b.y-6,round(Math.atan2(a.y-b.y,b.x-a.x)*180/Math.PI)+'° (screen)')}else label(b.x+3,b.y-6,(t==='forecast'?'Proyeksi manual · ':'')+round(r.diff)+' · '+round(r.percent)+'% · '+r.bars+' bars');return true}
 if(t==='regression'||t==='anchoredVwap'||t==='fixedVolume'||t==='anchoredVolume'){
  const bars=chart.candles;const start=Math.max(0,Math.min(bars.length-1,Math.round(logicalAt(bars,d.a.time,d.a.logical)))),end=t==='anchoredVwap'||t==='anchoredVolume'?bars.length-1:Math.max(0,Math.min(bars.length-1,Math.round(logicalAt(bars,d.b.time,d.b.logical)))),lo=Math.min(start,end),hi=Math.max(start,end),data=bars.slice(lo,hi+1);
  const pos=(i,price)=>{const x=chart.logicalToCoordinate(i),y=chart.priceToCoordinate(price);return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null};
  if(t==='regression'){const r=regression(data);if(r){for(const k of [-2,0,2]){const p=pos(lo,r.intercept+k*r.sigma),q=pos(hi,r.intercept+r.slope*(hi-lo)+k*r.sigma);if(p&&q)line(p,q,k?'opacity=".6"':'')} }else label(a.x,a.y-7,'Butuh ≥2 candle');return true}
  if(t==='anchoredVwap'){const values=anchoredVWAP(data);let prior=null;for(let i=0;i<values.length;i++){const q=values[i]===null?null:pos(lo+i,values[i]);if(q&&prior)line(prior,q);prior=q}if(!values.some(Number.isFinite))text(a,'Volume tidak tersedia');else label(a.x,a.y-6,'AVWAP · HLC3');return true}
  const profile=estimatedProfile(data);if(!profile){text(a,'Volume tidak tersedia');return true}
  const max=Math.max(...profile.values),x=chart.logicalToCoordinate(lo),width=Math.min(130,Math.max(30,Math.abs(b.x-a.x)||100));if(!Number.isFinite(x)||max<=0)return true;
  profile.values.forEach((v,i)=>{if(v<=0)return;const top=chart.priceToCoordinate(profile.lo+profile.dx*(i+1)),bot=chart.priceToCoordinate(profile.lo+profile.dx*i);if(Number.isFinite(top)&&Number.isFinite(bot))rect(x,top,x+width*v/max,bot,style.fill,.4,color)});label(x,a.y-7,'Volume profile · estimasi HLC3');return true;
 }
 if(t==='flatChannel'||t==='disjointChannel'){if(t==='flatChannel'&&c){const q={x:b.x,y:c.y};line(a,b);line({x:a.x,y:c.y},q);polygon([a,b,q,{x:a.x,y:c.y}])}else if(points.length>=4){line(a,b);line(points[2],points[3]);polygon([a,b,points[3],points[2]])}else polygon(points,false);return true}
 if(['pitchfork','schiffPitchfork','modifiedSchiff','insidePitchfork','pitchfan'].includes(t)){
  if(!c||points.length<3){polygon(points,false);return true}const mid=midpoint(b,c);let origin=a;
  if(t==='schiffPitchfork')origin={x:a.x,y:(a.y+b.y)/2};
  if(t==='modifiedSchiff')origin=midpoint(a,b);
  if(t==='insidePitchfork')origin=midpoint(a,c);
  const dx=mid.x-origin.x,dy=mid.y-origin.y;line(origin,mid,'','ray');line(b,{x:b.x+dx,y:b.y+dy},'','ray');line(c,{x:c.x+dx,y:c.y+dy},'','ray');line(b,c,'opacity=".55"');return true;
 }
 if(t==='fibChannel'){if(c){const dx=b.x-a.x,offset=c.y-a.y-(Math.abs(dx)>.01?(b.y-a.y)*(c.x-a.x)/dx:0);for(const v of [0,...fib]){line({x:a.x,y:a.y+offset*v},{x:b.x,y:b.y+offset*v});label(a.x+5,a.y+offset*v-3,String(v))}}else line(a,b);return true}
 if(t==='fibTime'||t==='fibTrendTime'||t==='cycleLines'||t==='timeCycles'||t==='sineWave'){
  const origin=t==='fibTrendTime'&&c?c:a,dx=b.x-a.x;if(Math.abs(dx)<2)return true;
  if(t==='sineWave'){const amp=(a.y-b.y),ps=Array.from({length:97},(_,i)=>({x:a.x+dx*i/24,y:a.y-amp*Math.sin(i/24*Math.PI/2)}));polygon(ps,false);return true}
  const multipliers=t==='cycleLines'||t==='timeCycles'?Array.from({length:25},(_,i)=>i):[0,1,2,3,5,8,13,21,34,55];
  for(const k of multipliers){const x=origin.x+dx*k;if(x<0||x>right)continue;if(t==='timeCycles'){const x2=x+dx;curve('M'+xy({x,y:a.y})+' Q'+xy({x:(x+x2)/2,y:a.y-Math.abs(dx)*.55})+' '+xy({x:x2,y:a.y}))}else{line({x,y:0},{x,y:bottom});label(x+3,15,String(k))}}return true;
 }
 if(t==='fibFan'||t==='gannFan'){for(const v of t==='gannFan'?[.125,.25,.333,.5,1,2,3,4,8]:fib){const q={x:b.x,y:a.y+(b.y-a.y)*v};line(a,q,'','ray');label(q.x+4,q.y-4,String(v))}return true}
 if(t==='fibCircle'||t==='fibArc'||t==='circle'){const R=Math.hypot(b.x-a.x,b.y-a.y);for(const v of t==='circle'?[1]:[.382,.5,.618,1,1.618]){const radius=R*v;if(t==='fibArc'){curve('M'+xy({x:a.x-radius,y:a.y})+' A'+n(radius)+' '+n(radius)+' 0 0 1 '+xy({x:a.x+radius,y:a.y}))}else circle(a,radius)}return true}
 if(t==='fibWedge'){if(c){for(const v of [0,...fib.filter(x=>x<=1)])line(a,mix(b,c,v),'','ray')}else line(a,b);return true}
 if(t==='gannBox'){rect(a.x,a.y,b.x,b.y);for(const v of [.25,.5,.75]){const x=a.x+(b.x-a.x)*v,y=a.y+(b.y-a.y)*v;line({x,y:a.y},{x,y:b.y});line({x:a.x,y},{x:b.x,y})}line(a,b);line({x:a.x,y:b.y},{x:b.x,y:a.y});return true}
 if(Object.hasOwn(PATTERNS,t)){polygon(points,false);const names=PATTERNS[t];points.forEach((p,i)=>text(p,names[i]??String(i+1)));return true}
 if(t==='datePriceRange'){rect(a.x,a.y,b.x,b.y);const r=rangeStats(d,chart.candles);label(Math.min(a.x,b.x)+4,Math.min(a.y,b.y)-5,round(r.diff)+' ('+round(r.percent)+'%) · '+r.bars+' bars');return true}
 if(t==='sector'){if(c){const r=Math.hypot(b.x-a.x,b.y-a.y),ang=Math.atan2(c.y-a.y,c.x-a.x),end={x:a.x+r*Math.cos(ang),y:a.y+r*Math.sin(ang)};if(r>0)group.push('<path d="M'+xy(a)+' L'+xy(b)+' A'+n(r)+' '+n(r)+' 0 0 1 '+xy(end)+' Z" fill="'+style.fill+'" fill-opacity="'+style.opacity+'"'+stroke+' pointer-events="all"/>')}else line(a,b);return true}
 if(t==='arrowMarker'){arrow(a,b);return true}
 if(t==='arrowUp'||t==='arrowDown'){const sign=t==='arrowUp'?-1:1;polygon([{x:a.x,y:a.y+14*sign},{x:a.x-9,y:a.y+4*sign},{x:a.x-4,y:a.y+4*sign},{x:a.x-4,y:a.y-12*sign},{x:a.x+4,y:a.y-12*sign},{x:a.x+4,y:a.y+4*sign},{x:a.x+9,y:a.y+4*sign}]);return true}
 if(t==='rotatedRectangle'){if(c){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,dist=(c.x-a.x)*nx+(c.y-a.y)*ny;polygon([a,b,{x:b.x+nx*dist,y:b.y+ny*dist},{x:a.x+nx*dist,y:a.y+ny*dist}])}else line(a,b);return true}
 if(isVariablePath(t)){polygon(points,t==='polyline'&&d.closed===true);if(t==='path'&&points.length>1)arrow(points.at(-2),points.at(-1));return true}
 if(t==='arc'||t==='curve'||t==='doubleCurve'){if(c){let path='M'+xy(a)+' Q'+xy(b)+' '+xy(c);if(t==='doubleCurve'&&points.length>=5)path+=' Q'+xy(points[3])+' '+xy(points[4]);curve(path)}else line(a,b);return true}
 if(NOTE_TYPES.includes(t)){let s=d.text||({emoji:'⭐',sticker:'🚀',visualIcon:'♥',flag:'⚑',pin:'●',idea:'💡'}[t]||'Note');if(t==='priceNote')s+=' · '+chart.formatPrice(d.a.price);if(['note','priceNote','comment','label','signpost'].includes(t))rect(a.x+2,a.y-25,a.x+Math.min(220,Math.max(43,s.length*6.7+11)),a.y+2,style.fill,.22,color);if(t==='flag')line(a,{x:a.x,y:a.y-30});text(a,s,['emoji','sticker','visualIcon'].includes(t)?25:13);return true}
 return false;
}
