/**
 * SMC Entry Models PRO v5 | Follow Candle: JavaScript adaptation for LUMAVUN.
 * The original Pine v6 file is bundled verbatim under indicators/.
 * A reimplementation, NOT a Pine interpreter or TradingView-equivalent calculation.
 */
import {PERIODS} from './market.js';

export const SMC_ID='smc-entry-pro-v5';
export const SMC_DEFAULTS=Object.freeze({
 useM1:true,useM2:true,useM3:true,entryChoice:'Midpoint 50%',requireFvgOB:true,
 swingLen:3,obLookback:12,sweepWindow:14,sweepMinAtr:.04,shiftBodyAtr:.55,nearFvgBars:6,minFvgAtr:.12,displaceAtr:1,
 htfMode:'Bias',htfTF:'4h',htfPoiType:'OB or FVG',htfSwing:3,poiMemory:12,
 qualityMode:'Ketat',minBodyRatio:.60,minBreakBodyAtr:.70,minBreakCloseAtr:.06,minDepartureAtr:.08,maxObOriginAge:8,minZoneWidthAtr:.04,maxZoneWidthAtr:2.2,useVolumeFilter:false,volumeMultiplier:1.2,invalidBy:'Close',invalidBufferAtr:.03,consumeDepth:.95,maxRetests:0,maxZoneAge:250,maxZoneDistance:12,deduplicateZone:true,
 rrTarget:2,slAtrBuffer:.12,maxStopAtr:10,pendingLife:40,
 showStructure:true,showBaseZones:true,showPending:true,showHtfPoi:true,zoneForward:18,zoneHistory:25,setupHistory:12,structureHist:45,structureTextPos:'Tengah',structureTextGap:.10,textSizeOpt:'Small',
 setupTextAlign:'Tengah',setupTextSizeOpt:'Tiny',setupLineWidth:1,setupLineStyleOp:'Solid',setupTextGapBars:4,setupStartBars:6,setupLeadBars:0,setupShowModel:false,
});

export const SMC_GROUPS=[
 ['01 · Entry Models',[
  ['useM1','M1 · Sweep → CHoCH/MSS','bool'],['useM2','M2 · OB continuation','bool'],['useM3','M3 · FVG sniper','bool'],['entryChoice','Zona entry','select',['Midpoint 50%','Proximal']],['requireFvgOB','M2: perlu FVG dekat BOS','bool']]],
 ['02 · Structure / Liquidity',[
  ['swingLen','Pivot LTF','int',1,20],['obLookback','OB lookback','int',2,40],['sweepWindow','Sweep window','int',2,100],['sweepMinAtr','Sweep minimum ATR','float',0,2],['shiftBodyAtr','Body shift ATR','float',0,3],['nearFvgBars','FVG ↔ BOS distance','int',1,30],['minFvgAtr','FVG min ATR','float',0,10],['displaceAtr','Displacement ATR','float',.1,10]]],
 ['03 · Higher Timeframe',[
  ['htfMode','Konfirmasi HTF','select',['Off','Bias','POI + Sweep']],['htfTF','Timeframe HTF','select',['1h','4h','1d','1w']],['htfPoiType','Sumber POI','select',['OB only','FVG only','OB or FVG']],['htfSwing','Pivot HTF','int',1,12],['poiMemory','POI memory (bar)','int',1,100]]],
 ['04 · Validasi Zona',[
  ['qualityMode','Quality threshold','select',['Ketat','Normal','Longgar']],['minBodyRatio','Min body / range','float',.3,.95],['minBreakBodyAtr','Min BOS body ATR','float',.2,3],['minBreakCloseAtr','BOS close beyond ATR','float',0,1],['minDepartureAtr','OB departure ATR','float',0,2],['maxObOriginAge','Max OB origin age','int',1,40],['minZoneWidthAtr','Min zone ATR','float',0,1],['maxZoneWidthAtr','Max zone ATR','float',.2,10],['useVolumeFilter','Volume filter','bool'],['volumeMultiplier','Volume / SMA20','float',1,5],['invalidBy','Invalidation','select',['Close','Wick']],['invalidBufferAtr','Invalidation buffer ATR','float',0,1],['consumeDepth','Mitigation depth','float',.5,1],['maxRetests','Max retests (0 = fresh)','int',0,5],['maxZoneAge','Max zone age','int',10,3000],['maxZoneDistance','Max zone distance ATR','float',2,100],['deduplicateZone','Deduplicate overlap','bool']]],
 ['05 · Risk Management',[
  ['rrTarget','Target RR','float',.5,20],['slAtrBuffer','SL buffer ATR','float',0,3],['maxStopAtr','Max stop ATR','float',.25,50],['pendingLife','Pending life (bar)','int',2,300]]],
 ['06 · Drawing / History',[
  ['showStructure','Show BOS / CHoCH / sweep','bool'],['showBaseZones','Show OB / FVG','bool'],['showPending','Show pending zones','bool'],['showHtfPoi','Show HTF POI','bool'],['zoneForward','Zone projection (bar)','int',2,150],['zoneHistory','Zone history','int',1,80],['setupHistory','Setup history','int',1,35],['structureHist','Structure history','int',5,100],['structureTextPos','Structure text position','select',['Tengah','Ujung kanan']],['textSizeOpt','Structure text size','select',['Tiny','Small','Normal']]]],
 ['07 · Entry / SL / TP',[
  ['setupTextAlign','Line text position','select',['Kiri','Tengah','Kanan']],['setupTextSizeOpt','Setup text size','select',['Tiny','Small','Normal','Large']],['setupLineWidth','Line width','int',1,5],['setupLineStyleOp','Line style','select',['Solid','Dashed','Dotted']],['setupTextGapBars','Text line gap (bar)','int',1,20],['setupStartBars','Start line offset','int',0,20],['setupLeadBars','Lead bars','int',0,3],['setupShowModel','Show model on entry','bool']]],
];
export function smcSettings(value={}){
 const merged={...SMC_DEFAULTS};
 for(const [,items] of SMC_GROUPS)for(const [key,,type,a,b] of items){let v=value?.[key];if(type==='bool'){if(typeof v==='boolean')merged[key]=v;}
 else if(type==='select'){if(a.includes(v))merged[key]=v;}
 else if(Number.isFinite(v)){merged[key]=Math.min(b,Math.max(a,type==='int'?Math.round(v):v));}}
 return merged;
}
const ok=v=>Number.isFinite(v);
const overlap=(t,b,tt,bb)=>Math.max(0,Math.min(t,tt)-Math.max(b,bb))/Math.min(t-b,tt-b);
const touch=(c,z)=>c.low<=z.top&&c.high>=z.bottom;
const median=(c)=>(c.high+c.low)*.5;
const isPH=(items,i,len)=>{const p=i-len;if(p<len)return false;const v=items[p].high;for(let k=p-len;k<=i;k++)if(k!==p&&items[k].high>=(k>p?v:v+Number.EPSILON))return false;return true;};
const isPL=(items,i,len)=>{const p=i-len;if(p<len)return false;const v=items[p].low;for(let k=p-len;k<=i;k++)if(k!==p&&items[k].low<=(k>p?v:v-Number.EPSILON))return false;return true;};
const findOB=(cs,i,side,lookback)=>{for(let k=1;k<=lookback&&i-k>=0;k++){const c=cs[i-k];if(side===1?c.close<c.open:c.close>c.open)return{top:c.high,bottom:c.low,left:i-k};}return null};
export function atrSeries(cs,n=14){const a=Array(cs.length).fill(null);let sum=0,prev=0;for(let i=0;i<cs.length;i++){const c=cs[i],tr=i===0?c.high-c.low:Math.max(c.high-c.low,Math.abs(c.high-cs[i-1].close),Math.abs(c.low-cs[i-1].close));if(i<n)sum+=tr;if(i===n-1){prev=sum/n;a[i]=prev;}else if(i>=n){prev=(prev*(n-1)+tr)/n;a[i]=prev;}}return a;}
export function aggregateHtf(candles,seconds){const groups=[];for(let i=0;i<candles.length;i++){const c=candles[i],bucket=Math.floor(c.time/seconds)*seconds,last=groups.at(-1);if(!last||last.time!==bucket)groups.push({...c,time:bucket,lastIndex:i,firstIndex:i});else{last.high=Math.max(last.high,c.high);last.low=Math.min(last.low,c.low);last.close=c.close;last.volume+=c.volume||0;last.lastIndex=i;}}return groups;}
function htfContexts(bars,s){
 const contexts=[],atr=atrSeries(bars),trend={h:null,l:null,hBroken:false,lBroken:false,side:0,poi:null,gap:null,bias:0};
 for(let i=0;i<bars.length;i++){
  const c=bars[i],a=atr[i];if(isPH(bars,i,s.htfSwing)){trend.h=bars[i-s.htfSwing].high;trend.hBroken=false;}if(isPL(bars,i,s.htfSwing)){trend.l=bars[i-s.htfSwing].low;trend.lBroken=false;}
  const prev=bars[i-1];const up=trend.h!==null&&!trend.hBroken&&c.close>trend.h&&(!prev||prev.close<=trend.h),dn=trend.l!==null&&!trend.lBroken&&c.close<trend.l&&(!prev||prev.close>=trend.l);
  if(up||dn){const d=up?1:-1;if(up)trend.hBroken=true;else trend.lBroken=true;trend.bias=d;const ob=findOB(bars,i,d,s.obLookback);trend.poi=ob?{side:d,top:ob.top,bottom:ob.bottom}:null;}
  if(trend.poi&&((trend.poi.side===1&&c.close<trend.poi.bottom)||(trend.poi.side===-1&&c.close>trend.poi.top)))trend.poi=null;
  if(i>=2&&ok(a)&&ok(atr[i-1])){const cc=bars[i-1],bull=c.low>bars[i-2].high&&(c.low-bars[i-2].high)>=s.minFvgAtr*a&&cc.close>cc.open&&(cc.close-cc.open)>=s.displaceAtr*atr[i-1],bear=c.high<bars[i-2].low&&(bars[i-2].low-c.high)>=s.minFvgAtr*a&&cc.close<cc.open&&(cc.open-cc.close)>=s.displaceAtr*atr[i-1];if(bull&&trend.bias===1)trend.gap={side:1,top:c.low,bottom:bars[i-2].high};if(bear&&trend.bias===-1)trend.gap={side:-1,top:bars[i-2].low,bottom:c.high};}
  if(trend.gap&&((trend.gap.side===1&&c.close<trend.gap.bottom)||(trend.gap.side===-1&&c.close>trend.gap.top)))trend.gap=null;
  let chosen=s.htfPoiType==='OB only'?trend.poi:s.htfPoiType==='FVG only'?trend.gap:(trend.poi&&trend.poi.side===trend.bias?trend.poi:trend.gap);
  contexts.push({bias:trend.bias,poi:chosen?{...chosen}:null});
 }return contexts;
}
const info = (n,reason,extra={})=>({bar:n,reason,...extra});
/** Compute all drawings from CLOSED input candles. Never consumes chart future bars. */
export function computeSMC(candles,settings={},tf='1h',{excludeLast=false}={}){
 const s=smcSettings(settings), cs=excludeLast?candles.slice(0,-1):candles.slice(),n=cs.length;
 const out={structures:[],zones:[],pending:[],trades:[],events:[],htfPoi:null,stats:{buyPlans:0,sellPlans:0,entries:0,tp:0,sl:0},warning:''};
 if(n<Math.max(50,s.swingLen*3+16))return {...out,warning:'Butuh setidaknya 50 candle tertutup untuk SMC.'};
 const ltfSec=PERIODS[tf]||3600,htfSec=PERIODS[s.htfTF]||14400;
 let groups=[],contexts=[];
 if(s.htfMode!=='Off'){
  if(ltfSec>=htfSec)return {...out,warning:`Timeframe HTF (${s.htfTF}) harus lebih besar dari chart (${tf}). Ubah HTF atau pilih Off.`};
  groups=aggregateHtf(cs,htfSec);contexts=htfContexts(groups,s);
 }
 const atr=atrSeries(cs),volAvg=Array(n).fill(null);let rolling=0;for(let i=0;i<n;i++){rolling+=cs[i].volume||0;if(i>=20)rolling-=cs[i-20].volume||0;if(i>=19)volAvg[i]=rolling/20;}
 let swingHigh=null,swingLow=null,swingHiAt=-1,swingLoAt=-1,hiBroken=false,loBroken=false,hiSwept=false,loSwept=false,structureDir=0,lastBullBreakAt=-1,lastBearBreakAt=-1;
 let bullSweep=null,bearSweep=null,lastBullPoiAt=-1,lastBearPoiAt=-1,seenPoiKey='',localPoiInvalid=false;
 let bullFvg=null,bearFvg=null;
 let groupIndex=0,lastHtfPoi=null;
 const pass=score=>score>=(s.qualityMode==='Ketat'?85:s.qualityMode==='Normal'?75:65);
 const quality=(impulse,eff,structure,htf,confluence,departure)=>(impulse>=s.displaceAtr*1.25?25:impulse>=s.displaceAtr?20:impulse>=s.displaceAtr*.65?10:0)+(eff>=s.minBodyRatio+.1?15:eff>=s.minBodyRatio?10:0)+(structure?20:0)+(htf?15:0)+(confluence?15:0)+(departure?10:0);
 const width=(top,bot,a)=>ok(top)&&ok(bot)&&ok(a)&&a>0&&top>bot&&(top-bot)/a>=s.minZoneWidthAtr&&(top-bot)/a<=s.maxZoneWidthAtr;
 const evt=(i,type,other={})=>out.events.push(info(i,type,other));
 const structure=(label,price,left,side,i)=>{if(!s.showStructure)return;out.structures.push({label,price,left:Math.max(0,left),end:i,side});if(out.structures.length>s.structureHist)out.structures.shift();};
 const addZone=(label,side,top,bottom,left,score,i,a)=>{
  if(!s.showBaseZones||!width(top,bottom,a)||!pass(score))return;
  if(s.deduplicateZone&&out.zones.some(z=>z.side===side&&i-z.born<=s.nearFvgBars*2&&overlap(top,bottom,z.top,z.bottom)>=.65&&z.score>=score))return;
  if(s.deduplicateZone)out.zones=out.zones.filter(z=>!(z.side===side&&i-z.born<=s.nearFvgBars*2&&overlap(top,bottom,z.top,z.bottom)>=.65&&z.score<score));
  out.zones.push({label,side,top,bottom,left:Math.max(0,left),born:i,score,touches:0,wasTouch:false,end:i+s.zoneForward});if(out.zones.length>s.zoneHistory)out.zones.shift();
 };
 const plan=(model,side,top,bottom,stopRef,i,a)=>{
  if(!width(top,bottom,a)||!ok(stopRef))return false;
  const entry=s.entryChoice==='Midpoint 50%'?(top+bottom)*.5:side===1?top:bottom,sl=side===1?Math.min(stopRef,bottom)-s.slAtrBuffer*a:Math.max(stopRef,top)+s.slAtrBuffer*a,risk=Math.abs(entry-sl);
  const valid=side===1?sl<entry&&entry<cs[i].close:sl>entry&&entry>cs[i].close;
  const dup=out.pending.some(p=>p.side===side&&p.model===model&&overlap(top,bottom,p.top,p.bottom)>=.8);
  if(!valid||dup||risk<=0||risk>s.maxStopAtr*a)return false;
  out.pending.push({model,side,top,bottom,entry,sl,tp:entry+side*risk*s.rrTarget,born:i,wasTouch:false,touches:0,end:i+s.zoneForward});if(out.pending.length>14)out.pending.shift();
  if(side===1)out.stats.buyPlans++;else out.stats.sellPlans++;evt(i,'plan',{side,model,entry,sl});return true;
 };
 const limitFvg=(f,c,i,htfAgree)=>{
  if(!f||!f.live||i<=f.born)return;const tapped=touch(c,f);if(tapped&&!f.wasTouch)f.touches++;f.wasTouch=tapped;
  const depth=tapped?(f.side===1?(f.top-c.low)/(f.top-f.bottom):(c.high-f.bottom)/(f.top-f.bottom)):0;
  if(depth>=s.consumeDepth||f.touches>s.maxRetests||i-f.born>s.maxZoneAge||(s.htfMode!=='Off'&&!htfAgree))f.live=false;
 };
 for(let i=0;i<n;i++){
  const c=cs[i],p=cs[i-1],p2=cs[i-2],a=atr[i];if(!ok(a)||a<=0)continue;
  let bias=0,poi=null;
  if(s.htfMode!=='Off'){
   while(groupIndex+1<groups.length&&groups[groupIndex+1].time<=c.time)groupIndex++;
   const ctx=groupIndex>0?contexts[groupIndex-1]:null;
   bias=ctx?.bias||0;poi=ctx?.poi||null;
   const key=poi?`${poi.side}:${poi.top}:${poi.bottom}`:'';
   if(key!==seenPoiKey){localPoiInvalid=false;seenPoiKey=key;}
   if(poi&&touch(c,poi)){
    const bad=s.invalidBy==='Wick'?(poi.side===1?c.low<poi.bottom-s.invalidBufferAtr*a:c.high>poi.top+s.invalidBufferAtr*a):(poi.side===1?c.close<poi.bottom-s.invalidBufferAtr*a:c.close>poi.top+s.invalidBufferAtr*a);
    const depth=poi.side===1?(poi.top-c.low)/(poi.top-poi.bottom):(c.high-poi.bottom)/(poi.top-poi.bottom);
    if(bad||depth>=s.consumeDepth)localPoiInvalid=true;
   }
   if(!localPoiInvalid&&poi&&touch(c,poi)){if(poi.side===1)lastBullPoiAt=i;else lastBearPoiAt=i;}
   lastHtfPoi=(!localPoiInvalid&&poi)?{...poi,left:i,end:i+s.zoneForward,label:`HTF ${s.htfTF} POI ${poi.side===1?'BUY':'SELL'}`}:null;
  }
  const agreeBull=s.htfMode==='Off'||bias===1,agreeBear=s.htfMode==='Off'||bias===-1;
  // Keep state maintenance ahead of newly created zones / trade drawings.
  limitFvg(bullFvg,c,i,agreeBull);limitFvg(bearFvg,c,i,agreeBear);
  // Remove stale zones. Pine removes a zone's draw object entirely when invalidated.
  out.zones=out.zones.filter(z=>{
   const after=i>z.born,tapped=after&&touch(c,z);if(tapped&&!z.wasTouch)z.touches++;z.wasTouch=tapped;
   const depth=tapped?(z.side===1?(z.top-c.low)/(z.top-z.bottom):(c.high-z.bottom)/(z.top-z.bottom)):0;
   const broken=after&&(s.invalidBy==='Wick'?(z.side===1?c.low<z.bottom-s.invalidBufferAtr*a:c.high>z.top+s.invalidBufferAtr*a):(z.side===1?c.close<z.bottom-s.invalidBufferAtr*a:c.close>z.top+s.invalidBufferAtr*a));
   const distant=(z.side===1?Math.max(0,c.close-z.top):Math.max(0,z.bottom-c.close))/a>s.maxZoneDistance;
   const remove=broken||depth>=s.consumeDepth||z.touches>s.maxRetests||i-z.born>s.maxZoneAge||(after&&distant)||(s.htfMode!=='Off'&&(z.side===1?!agreeBull:!agreeBear));
   if(remove)evt(i,'zoneRemoved',{label:z.label});else z.end=i+s.zoneForward;
   return !remove;
  });
  // Live trades are updated first, and are ended EXACTLY at their hit candle.
  let busy=false;for(const tr of out.trades){if(tr.status!==0)continue;busy=true;const hitSL=i>tr.born&&(tr.side===1?c.low<=tr.sl:c.high>=tr.sl),hitTP=i>tr.born&&(tr.side===1?c.high>=tr.tp:c.low<=tr.tp);
   if(hitSL||hitTP){tr.status=hitSL?-1:1;tr.end=i;out.stats[hitSL?'sl':'tp']++;evt(i,hitSL?'sl':'tp',{side:tr.side,model:tr.model,price:hitSL?tr.sl:tr.tp});}else tr.end=i+s.setupLeadBars;}
  // Pending re-tests: latest model priority M1 > M2 > M3.
  for(let j=out.pending.length-1;j>=0;j--){const z=out.pending[j],after=i>z.born,tapped=after&&c.low<=z.entry&&c.high>=z.entry,tappedZone=after&&touch(c,z);if(tappedZone&&!z.wasTouch)z.touches++;z.wasTouch=tappedZone;
   const crossedStop=z.side===1?c.low<=z.sl:c.high>=z.sl;
   const invalid=after&&(s.invalidBy==='Wick'?(z.side===1?c.low<z.bottom-s.invalidBufferAtr*a:c.high>z.top+s.invalidBufferAtr*a):(z.side===1?c.close<z.bottom-s.invalidBufferAtr*a:c.close>z.top+s.invalidBufferAtr*a));
   const stale=i-z.born>s.pendingLife||(s.htfMode!=='Off'&&(z.side===1?!agreeBull:!agreeBear))||(tappedZone&&z.touches>s.maxRetests&&!tapped)||(invalid&&!tapped);
   if(stale){out.pending.splice(j,1);continue;}
   if(tapped&&!busy){const tr={model:z.model,side:z.side,entry:z.entry,sl:z.sl,tp:z.tp,born:i,end:i+s.setupLeadBars,status:crossedStop?-1:0};out.trades.push(tr);out.stats.entries++;evt(i,'entry',{side:tr.side,model:tr.model,entry:tr.entry});if(crossedStop){tr.end=i;out.stats.sl++;evt(i,'sl',{side:tr.side,model:tr.model,price:tr.sl});}if(out.trades.length>s.setupHistory)out.trades.shift();out.pending.splice(j,1);busy=true;
   }else z.end=i+s.zoneForward;
  }
  // Confirmed LTF pivots: they cannot be used until right-hand bars close.
  if(isPH(cs,i,s.swingLen)){swingHigh=cs[i-s.swingLen].high;swingHiAt=i-s.swingLen;hiBroken=false;hiSwept=false;}
  if(isPL(cs,i,s.swingLen)){swingLow=cs[i-s.swingLen].low;swingLoAt=i-s.swingLen;loBroken=false;loSwept=false;}
  const sweepLow=!loSwept&&swingLow!==null&&i>swingLoAt&&c.low<swingLow-Math.max(1e-10,a*s.sweepMinAtr)&&c.close>swingLow;
  const sweepHigh=!hiSwept&&swingHigh!==null&&i>swingHiAt&&c.high>swingHigh+Math.max(1e-10,a*s.sweepMinAtr)&&c.close<swingHigh;
  const poiTouchBull=!!poi&&!localPoiInvalid&&poi.side===1&&touch(c,poi),poiTouchBear=!!poi&&!localPoiInvalid&&poi.side===-1&&touch(c,poi);
  if(sweepLow){loSwept=true;bullSweep={bar:i,price:c.low,atPoi:poiTouchBull};structure('SSL SWEEP',swingLow,swingLoAt,1,i);evt(i,'sweep',{side:1})}
  if(sweepHigh){hiSwept=true;bearSweep={bar:i,price:c.high,atPoi:poiTouchBear};structure('BSL SWEEP',swingHigh,swingHiAt,-1,i);evt(i,'sweep',{side:-1})}
  const bullBreak=!hiBroken&&swingHigh!==null&&c.close>swingHigh&&(!p||p.close<=swingHigh)&&i>swingHiAt,bearBreak=!loBroken&&swingLow!==null&&c.close<swingLow&&(!p||p.close>=swingLow)&&i>swingLoAt;
  const oldDir=structureDir;
  if(bullBreak){hiBroken=true;structureDir=1;lastBullBreakAt=i;structure(oldDir===-1?'CHoCH':'BOS',swingHigh,swingHiAt,1,i);evt(i,'bullBreak');}
  if(bearBreak){loBroken=true;structureDir=-1;lastBearBreakAt=i;structure(oldDir===1?'CHoCH':'BOS',swingLow,swingLoAt,-1,i);evt(i,'bearBreak');}
  const body0=Math.abs(c.close-c.open),eff0=body0/Math.max(c.high-c.low,1e-12),body1=p?Math.abs(p.close-p.open):0,eff1=p?body1/Math.max(p.high-p.low,1e-12):0;
  const volumeOK0=!s.useVolumeFilter||(ok(volAvg[i])&&c.volume>=volAvg[i]*s.volumeMultiplier),volumeOK1=!s.useVolumeFilter||(ok(volAvg[i-1])&&p.volume>=volAvg[i-1]*s.volumeMultiplier);
  const displacement=!!p&&ok(atr[i-1])&&body1>=s.displaceAtr*atr[i-1];
  const bullFvgRaw=!!p2&&c.low>p2.high&&(c.low-p2.high)>=s.minFvgAtr*a&&p.close>p.open&&displacement;
  const bearFvgRaw=!!p2&&c.high<p2.low&&(p2.low-c.high)>=s.minFvgAtr*a&&p.close<p.open&&displacement;
  const recentBullBreak=lastBullBreakAt>=0&&i-lastBullBreakAt<=s.nearFvgBars,recentBearBreak=lastBearBreakAt>=0&&i-lastBearBreakAt<=s.nearFvgBars,recentBullSweep=!!bullSweep&&i-bullSweep.bar<=s.sweepWindow,recentBearSweep=!!bearSweep&&i-bearSweep.bar<=s.sweepWindow;
  const bullFvgScore=quality(body1/(atr[i-1]||a),eff1,structureDir===1,agreeBull,recentBullBreak||recentBullSweep,c.close>median(c));
  const bearFvgScore=quality(body1/(atr[i-1]||a),eff1,structureDir===-1,agreeBear,recentBearBreak||recentBearSweep,c.close<median(c));
  const bullFVG=bullFvgRaw&&eff1>=s.minBodyRatio&&agreeBull&&volumeOK1&&width(c.low,p2.high,a)&&pass(bullFvgScore),bearFVG=bearFvgRaw&&eff1>=s.minBodyRatio&&agreeBear&&volumeOK1&&width(p2.low,c.high,a)&&pass(bearFvgScore);
  if(bullFVG){bullFvg={side:1,top:c.low,bottom:p2.high,born:i,touches:0,wasTouch:false,live:true};addZone('FVG ↑',1,c.low,p2.high,i-2,bullFvgScore,i,a);}
  if(bearFVG){bearFvg={side:-1,top:p2.low,bottom:c.high,born:i,touches:0,wasTouch:false,live:true};addZone('FVG ↓',-1,p2.low,c.high,i-2,bearFvgScore,i,a);}
  const obBull=findOB(cs,i,1,Math.min(s.obLookback,s.maxObOriginAge)),obBear=findOB(cs,i,-1,Math.min(s.obLookback,s.maxObOriginAge));
  const bullNearGap=!!bullFvg?.live&&i-bullFvg.born<=s.nearFvgBars,bearNearGap=!!bearFvg?.live&&i-bearFvg.born<=s.nearFvgBars;
  const bullObScore=quality(body0/a,eff0,bullBreak,agreeBull,bullNearGap||recentBullSweep,!!obBull&&c.close>obBull.top+a*s.minDepartureAtr);
  const bearObScore=quality(body0/a,eff0,bearBreak,agreeBear,bearNearGap||recentBearSweep,!!obBear&&c.close<obBear.bottom-a*s.minDepartureAtr);
  const strongBull=bullBreak&&c.close>c.open&&c.close>=swingHigh+s.minBreakCloseAtr*a&&body0>=s.minBreakBodyAtr*a&&eff0>=s.minBodyRatio;
  const strongBear=bearBreak&&c.close<c.open&&c.close<=swingLow-s.minBreakCloseAtr*a&&body0>=s.minBreakBodyAtr*a&&eff0>=s.minBodyRatio;
  const validBull=strongBull&&agreeBull&&volumeOK0&&obBull&&width(obBull.top,obBull.bottom,a)&&c.close>obBull.top+a*s.minDepartureAtr&&pass(bullObScore);
  const validBear=strongBear&&agreeBear&&volumeOK0&&obBear&&width(obBear.top,obBear.bottom,a)&&c.close<obBear.bottom-a*s.minDepartureAtr&&pass(bearObScore);
  if(validBull)addZone('BULL OB',1,obBull.top,obBull.bottom,obBull.left,bullObScore,i,a);
  if(validBear)addZone('BEAR OB',-1,obBear.top,obBear.bottom,obBear.left,bearObScore,i,a);
  const otherLong=agreeBull&&(s.htfMode!=='POI + Sweep'||i-lastBullPoiAt<=s.poiMemory&&lastBullPoiAt>=0),otherShort=agreeBear&&(s.htfMode!=='POI + Sweep'||i-lastBearPoiAt<=s.poiMemory&&lastBearPoiAt>=0);
  const bullSweepShift=bullBreak&&c.close>c.open&&body0>=s.shiftBodyAtr*a&&!!bullSweep&&i>bullSweep.bar&&i-bullSweep.bar<=s.sweepWindow;
  const bearSweepShift=bearBreak&&c.close<c.open&&body0>=s.shiftBodyAtr*a&&!!bearSweep&&i>bearSweep.bar&&i-bearSweep.bar<=s.sweepWindow;
  if(s.useM3&&bullFVG&&structureDir===1&&otherLong)plan('M3 FVG',1,c.low,p2.high,Math.min(p.low,p2.high),i,a);
  if(s.useM3&&bearFVG&&structureDir===-1&&otherShort)plan('M3 FVG',-1,p2.low,c.high,Math.max(p.high,p2.low),i,a);
  if(s.useM2&&validBull&&oldDir===1&&otherLong&&(!s.requireFvgOB||bullNearGap))plan('M2 OB',1,obBull.top,obBull.bottom,obBull.bottom,i,a);
  if(s.useM2&&validBear&&oldDir===-1&&otherShort&&(!s.requireFvgOB||bearNearGap))plan('M2 OB',-1,obBear.top,obBear.bottom,obBear.top,i,a);
  if(s.useM1&&bullSweepShift&&agreeBull&&(s.htfMode!=='POI + Sweep'||bullSweep.atPoi)){if(validBull)plan('M1 SWEEP+OB',1,obBull.top,obBull.bottom,bullSweep.price,i,a);else if(bullNearGap)plan('M1 SWEEP+FVG',1,bullFvg.top,bullFvg.bottom,bullSweep.price,i,a);}
  if(s.useM1&&bearSweepShift&&agreeBear&&(s.htfMode!=='POI + Sweep'||bearSweep.atPoi)){if(validBear)plan('M1 SWEEP+OB',-1,obBear.top,obBear.bottom,bearSweep.price,i,a);else if(bearNearGap)plan('M1 SWEEP+FVG',-1,bearFvg.top,bearFvg.bottom,bearSweep.price,i,a);}
  if(bullSweepShift)bullSweep=null;if(bearSweepShift)bearSweep=null;
 }
 out.htfPoi=s.showHtfPoi?lastHtfPoi:null;
 if(s.htfMode!=='Off'&&!contexts.some(x=>x.bias!==0))out.warning='Bias HTF belum terbentuk dalam riwayat yang tersedia. Coba mode Off atau timeframe lebih kecil.';
 return out;
}
