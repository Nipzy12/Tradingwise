// Shared, independently implemented desktop drawing navigation.
// The source catalog owns what can actually be placed on the chart.
// Do not present unavailable TradingView tools as functioning tools.
import {TOOL_CATALOG} from './drawing-model.js';
import {PALETTE_GROUPS,LABELS} from './drawing-palette-model.js';

export const DESKTOP_GROUPS=Object.freeze([
 {id:'cursor',label:'Kursor',defaultTool:'pointer'},
 {id:'trend',label:'Garis tren',defaultTool:'trend'},
 {id:'fib',label:'Gann dan Fibonacci',defaultTool:'fibo'},
 {id:'patterns',label:'Motif',defaultTool:'xabcd'},
 {id:'projection',label:'Proyeksi dan posisi',defaultTool:'long'},
 {id:'shapes',label:'Bentuk geometris',defaultTool:'brush'},
 {id:'annotation',label:'Anotasi dan teks',defaultTool:'text'},
 {id:'visual',label:'Ikon dan visual',defaultTool:'emoji'},
 {id:'smc',label:'SMC / ICT',defaultTool:'obZone'},
 {id:'measure',label:'Pengukuran',defaultTool:'ruler'}
]);

const extras={
 cursor:['pointer','eraser'],
 measure:['ruler','priceRange','dateRange','datePriceRange']
};
const measurement=new Set(extras.measure);
export function desktopGroupItems(groupId,query=''){
 const group=DESKTOP_GROUPS.find(g=>g.id===groupId);
 if(!group)return [];
 const source=extras[groupId]||PALETTE_GROUPS.find(([id])=>id===groupId)?.[2]||[];
 const ids=groupId==='projection'?source.filter(id=>!measurement.has(id)):source;
 const q=String(query).toLocaleLowerCase().trim();
 return [...new Set(ids)].filter(id=>Object.hasOwn(TOOL_CATALOG,id)).map(id=>({
  ...TOOL_CATALOG[id],translatedLabel:LABELS[id]||TOOL_CATALOG[id].label
 })).filter(item=>!q||[item.id,item.label,item.translatedLabel,group.label].join(' ').toLocaleLowerCase().includes(q));
}
