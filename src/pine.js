import {ema,sma,rsi} from './indicators.js';
export const EXAMPLE=`//@version=6
indicator("LUMAVUN EMA Crossover", overlay=true)
fastLength = input.int(9, "Fast EMA")
slowLength = input.int(21, "Slow EMA")
fast = ta.ema(close, fastLength)
slow = ta.ema(close, slowLength)
plot(fast, title="EMA Fast", color=color.orange)
plot(slow, title="EMA Slow", color=color.aqua)`;
const PALETTE={orange:'#f0ae49',aqua:'#27c7d9',blue:'#5181ff',red:'#f25f76',green:'#10c59d',purple:'#ac88ff',yellow:'#eed36c',white:'#e1e5eb',fuchsia:'#f168da',teal:'#23cfa4',lime:'#92dc5d',gray:'#93a0ad'};
function args(s){const chunks=[];let cur='',depth=0,quote=null;for(const ch of s){if(quote){cur+=ch;if(ch===quote)quote=null;continue}if(ch==='"'||ch==="'"){quote=ch;cur+=ch;continue}if(ch==='(')depth++;if(ch===')')depth--;if(ch===','&&depth===0){chunks.push(cur.trim());cur=''}else cur+=ch}if(cur.trim())chunks.push(cur.trim());return chunks;}
function parseColor(text){const m=text?.match(/color\s*=\s*color\.([a-z]+)/);if(m)return PALETTE[m[1]]||'#80aaff';const hex=text?.match(/color\s*=\s*"(#[0-9a-fA-F]{6})"/);return hex?.[1]||'#7ca2fc';}
function scalar(v,vars){if(/^\d+(?:\.\d+)?$/.test(v))return Number(v);if(Object.hasOwn(vars,v)&&typeof vars[v]==='number')return vars[v];throw Error(`Parameter tidak didukung: ${v}`)}
export function compilePineSubset(source,candles){
 const rows=source.split(/\r?\n/), vars={};const outputs=[], closes=candles.map(c=>c.close),highs=candles.map(c=>c.high),lows=candles.map(c=>c.low), opens=candles.map(c=>c.open);
 const builtins={close:closes,high:highs,low:lows,open:opens};let overlay=true;let plots=0;
 function evalSeries(expr){expr=expr.trim();if(Object.hasOwn(builtins,expr))return builtins[expr];if(Object.hasOwn(vars,expr)&&Array.isArray(vars[expr]))return vars[expr];
  const func=expr.match(/^ta\.(ema|sma|rsi)\((.*)\)$/);if(func){const p=args(func[2]);if(p.length!==2)throw Error('Fungsi ta membutuhkan 2 argumen');const v=evalSeries(p[0]),n=scalar(p[1],vars);if(!Number.isInteger(n)||n<1||n>3000)throw Error('Panjang indikator harus integer 1..3000');return func[1]==='ema'?ema(v,n):func[1]==='sma'?sma(v,n):rsi(v,n)}
  throw Error(`Ekspresi Pine belum didukung: ${expr}`);
 }
 for(let index=0;index<rows.length;index++){
  const raw=rows[index].replace(/\/\/.*$/,'').trim();if(!raw)continue;
  try{
   const decl=raw.match(/^(indicator|strategy)\s*\((.*)\)\s*;?$/);if(decl){if(decl[1]==='strategy')throw Error('strategy() belum didukung dalam editor subset; gunakan tab Strategy Tester');overlay=!/overlay\s*=\s*false/.test(decl[2]);continue}
   const input=raw.match(/^([A-Za-z_]\w*)\s*=\s*input\.(int|float)\((.*)\)$/);if(input){vars[input[1]]=Number(args(input[3])[0]);if(!Number.isFinite(vars[input[1]]))throw Error('input tidak valid');continue}
   const assign=raw.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/);if(assign){vars[assign[1]]=evalSeries(assign[2]);continue}
   const plot=raw.match(/^plot\((.*)\)$/);if(plot){const ps=args(plot[1]),series=evalSeries(ps[0]);const title=ps.find(x=>x.startsWith('title='))?.match(/title\s*=\s*["']([^"']+)["']/)?.[1]||`Plot ${++plots}`;outputs.push({key:`pine${outputs.length}`,name:title,color:parseColor(plot[1]),pane:overlay?'main':'rsi',values:series});continue}
   if(raw.startsWith('//@'))continue;
   throw Error(`Sintaks di luar subset: ${raw.slice(0,70)}`);
  }catch(e){throw Error(`Baris ${index+1}: ${e.message}`)}
 }
 if(!outputs.length)throw Error('Tidak ada plot() yang bisa ditampilkan');return outputs;
}
