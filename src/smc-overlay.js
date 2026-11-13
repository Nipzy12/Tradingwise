const escapeXml=text=>String(text??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const colors={buy:'#12c69a',sell:'#f25c77',tp:'#22c55e',sl:'#ef4444',htf:'#b28afc'};
export class SMCOverlay{
 constructor(chart,root){this.chart=chart;this.root=root;this.data=null;this.settings=null;this.renderCount=0;this.width=0;this.height=0;}
 setData(result,settings){this.data=result;this.settings=settings;this.render();}
 clear(){this.data=null;this.render();}
 render(){const {root,chart,data,settings:s}=this;if(!root)return;const w=root.parentElement.clientWidth,h=root.parentElement.clientHeight;
  if(!data||!s||!chart.candles.length||w<20||h<20){root.innerHTML='';return;}
  root.setAttribute('viewBox',`0 0 ${w} ${h}`);root.setAttribute('width',w);root.setAttribute('height',h);
  const px=i=>chart.logicalToCoordinate(i),py=p=>chart.priceToCoordinate(p),cap=n=>Math.max(-20000,Math.min(20000,n)),num=p=>Number(p).toLocaleString('en-US',{maximumFractionDigits:p<10?5:2});
  const parts=[`<defs><clipPath id="smcPlotClip"><rect x="0" y="0" width="${Math.max(0,w-66)}" height="${Math.max(0,h-27)}"/></clipPath></defs><g clip-path="url(#smcPlotClip)" pointer-events="none">`];
  const rect=(z,fillOpacity=.1,strokeOpacity=.63,label='')=>{const x1=px(z.left),x2=px(z.end),a=py(z.top),b=py(z.bottom);if([x1,x2,a,b].some(v=>!Number.isFinite(v)))return;
   const col=z.side===1?colors.buy:colors.sell,x=cap(Math.min(x1,x2)),y=cap(Math.min(a,b)),width=Math.max(1,Math.min(40000,Math.abs(x2-x1))),height=Math.max(1,Math.abs(b-a));
   parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${col}" fill-opacity="${fillOpacity}" stroke="${col}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>`);
   if(label){const yText=cap(Math.max(10,Math.min(h-28,y+Math.min(13,height+12))));parts.push(`<text x="${cap(x+4)}" y="${yText}" fill="${col}" font-size="10" font-weight="600" paint-order="stroke" stroke="#0e1219" stroke-width="3">${escapeXml(label)}</text>`);}
  };
  if(data.htfPoi){const z=data.htfPoi,a=py(z.top),b=py(z.bottom),x=px(z.left),x2=px(z.end);if([a,b,x,x2].every(Number.isFinite)){
   parts.push(`<rect x="${cap(x)}" y="${cap(Math.min(a,b))}" width="${Math.max(1,x2-x)}" height="${Math.max(1,Math.abs(b-a))}" fill="${colors.htf}" fill-opacity=".1" stroke="${colors.htf}" stroke-opacity=".7"/>`);
   parts.push(`<text x="${cap(x+3)}" y="${cap(Math.min(a,b)-4)}" fill="${colors.htf}" font-size="10" paint-order="stroke" stroke="#0e1219" stroke-width="3">${escapeXml(z.label)}</text>`);}}
  for(const z of data.zones)rect(z,.11,.45,`${z.label}  Q${z.score}`);
  for(const z of data.pending)if(s.showPending)rect({...z,left:z.born},.18,.9,`${z.model} ${z.side===1?'BUY':'SELL'} @ ${num(z.entry)}`);
  if(s.showStructure)for(const z of data.structures){const x1=px(z.left),x2=px(z.end),y=py(z.price);if(![x1,x2,y].every(Number.isFinite))continue;const color=z.side===1?colors.buy:colors.sell,tx=s.structureTextPos==='Ujung kanan'?x2:x1+(x2-x1)*.5;
   parts.push(`<line x1="${cap(x1)}" y1="${cap(y)}" x2="${cap(x2)}" y2="${cap(y)}" stroke="${color}" stroke-width="1" stroke-dasharray="5 4" opacity=".86"/>`);
   parts.push(`<text x="${cap(tx)}" y="${cap(y+(z.side===1?-11:14))}" text-anchor="middle" fill="${color}" font-size="${s.textSizeOpt==='Tiny'?9:s.textSizeOpt==='Normal'?12:10}" paint-order="stroke" stroke="#0e1219" stroke-width="3">${escapeXml(z.label)}</text>`);
  }
  for(const z of data.trades){const left=Math.max(0,z.born-s.setupStartBars),right=z.end,xa=px(left),xb=px(right);if(![xa,xb].every(Number.isFinite))continue;
   const align=s.setupTextAlign==='Kiri'?.25:s.setupTextAlign==='Kanan'?.75:.5;const cx=xa+(xb-xa)*align,half=Math.min(Math.max(0,(xb-xa)*.34),Math.max(0,s.setupTextGapBars*4));
   const levels=[{price:z.entry,color:z.side===1?colors.buy:colors.sell,text:`Entry ${z.side===1?'↑':'↓'} ${s.setupShowModel?z.model+' ':''}${num(z.entry)}`},{price:z.sl,color:colors.sl,text:z.status===-1?`✕ SL HIT ${num(z.sl)}`:`SL ${num(z.sl)}`},{price:z.tp,color:colors.tp,text:z.status===1?`✓ TP HIT ${num(z.tp)}`:`TP ${s.rrTarget}R ${num(z.tp)}`}];
   const dash=s.setupLineStyleOp==='Dashed'?'6 4':s.setupLineStyleOp==='Dotted'?'2 4':null;
   for(const lv of levels){const y=py(lv.price);if(!Number.isFinite(y))continue;const dashAttr=dash?`stroke-dasharray="${dash}"`:'';
    const aEnd=Math.max(xa,cx-half),bStart=Math.min(xb,cx+half);
    parts.push(`<line x1="${cap(xa)}" y1="${cap(y)}" x2="${cap(aEnd)}" y2="${cap(y)}" stroke="${lv.color}" stroke-width="${s.setupLineWidth}" ${dashAttr}/><line x1="${cap(bStart)}" y1="${cap(y)}" x2="${cap(xb)}" y2="${cap(y)}" stroke="${lv.color}" stroke-width="${s.setupLineWidth}" ${dashAttr}/>`);
    const size={Tiny:10,Small:11,Normal:12,Large:14}[s.setupTextSizeOpt]||10;
    parts.push(`<text x="${cap(cx)}" y="${cap(y+3)}" font-weight="600" font-size="${size}" text-anchor="middle" fill="${lv.color}" paint-order="stroke" stroke="#0e1219" stroke-width="3">${escapeXml(lv.text)}</text>`);
   }
  }
  parts.push('</g>');root.innerHTML=parts.join('');this.renderCount++;
 }
}
