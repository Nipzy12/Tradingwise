import {TOOL_CATALOG,clone,normalizeStyle,normalizeDrawing,normalizeRisk,normalizeLevels,positionStats} from './drawing-model.js';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const isPosition=t=>t==='long'||t==='short';
const isBrush=t=>t==='brush'||t==='highlighter';
const tf=t=>{if(!Number.isFinite(t))return '';const d=new Date(t*1000);return Number.isFinite(d.getTime())?d.toISOString().slice(0,19):''};
const summary=d=>{const s=positionStats(d);return s?'RR 1:'+s.rr.toFixed(2)+' · Risk '+s.budget.toFixed(2)+' · Qty/lot '+s.qty.toLocaleString('en-US',{maximumFractionDigits:8})+' · TP P/L '+s.targetPnL.toFixed(2):'Posisi tidak valid: TP dan SL harus di sisi berlawanan dari entry.'};
export function openDrawingProperties(layer,id,{openModal,closeModal,toast}){
 const live=layer.drawings.find(x=>x.id===id);if(!live)return;
 const d=clone(live),s=normalizeStyle(d.type,d.style),risk=normalizeRisk(d.risk),t=d.type;
 const field=(title,key,value,extra='')=>'<label><span>'+title+'</span><input data-setting="'+key+'" value="'+esc(value)+'" '+extra+'></label>';
 const checkbox=(title,key,value)=>'<label><span>'+title+'</span><input data-setting="'+key+'" type="checkbox" '+(value?'checked':'')+'></label>';
 const points=TOOL_CATALOG[t].points>3?'<p class="settings-note">Ubah masing-masing titik motif dengan menarik handle langsung pada chart.</p>':isBrush(t)?'<p class="settings-note">Brush bisa digeser sebagai satu objek.</p>':['a','b','c'].filter(k=>d[k]&&(TOOL_CATALOG[t].points!==1||k==='a')).map(k=>{
   const name=isPosition(t)?({a:'Entry',b:'Take profit',c:'Stop loss'})[k]:'Titik '+({a:'1',b:'2',c:'3'})[k];
   return '<div class="drawing-coordinate"><strong>'+name+'</strong>'+field('Harga asli','price-'+k,d[k].price,'type="number" step="any" required')+field('Waktu (UTC)','time-'+k,tf(d[k].time),'type="datetime-local" step="1" required')+'</div>';
 }).join('');
 const fib=['fibo','fibExtension'].includes(t)?'<div class="drawing-form-section"><h4>Fibonacci</h4>'+field('Level (pisahkan koma)','levels',normalizeLevels(d.levels,t).join(', '))+'</div>':'';
 const rr=isPosition(t)?'<div class="drawing-form-section"><h4>Risk / Reward</h4>'+field('Saldo (quote asli)','balance',risk.balance,'type="number" min="0" step="any"')+field('Risk (%)','riskPercent',risk.percent,'type="number" min="0" max="100" step="any"')+field('Contract size (unit/lot)','contract',risk.contract,'type="number" min="0.00000001" step="any"')+'<div class="drawing-risk-summary" id="drawingRiskSummary">'+esc(summary(d))+'</div><p class="settings-note">Saldo/risk dalam mata uang quote asli. Ukuran lot adalah estimasi tanpa spread, fee, margin, dan batas lot broker. Contract size harus disesuaikan instrumen/broker.</p></div>':'';
 const body='<form id="drawingSettingsForm" class="drawing-properties"><div class="drawing-form-section"><h4>Style</h4>'+field('Warna garis','color',s.color,'type="color"')+field('Warna isi','fill',s.fill,'type="color"')+field('Ketebalan','width',s.width,'type="number" min="1" max="20" step="1"')+field('Opacity isi (0–1)','opacity',s.opacity,'type="number" min="0" max="1" step="0.05"')+'<label><span>Gaya garis</span><select data-setting="dash">'+['solid','dashed','dotted'].map(v=>'<option '+(v===s.dash?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+field('Label / teks','text',d.text,'maxlength="200"')+(['rectangle','obZone','fvgZone','fibo','fibExtension'].includes(t)?checkbox('Extend right','extend',s.extend):'')+checkbox('Kunci objek','locked',d.locked)+checkbox('Sembunyikan objek','hidden',d.hidden)+'</div><div class="drawing-form-section"><h4>Coordinates</h4>'+points+'</div>'+fib+rr+'<div class="modal-actions"><button type="button" class="mini-btn" id="drawingTemplateSave">Simpan sebagai default tool</button><button type="submit" class="primary-tiny">Terapkan</button></div><p class="settings-note">Titik harga selalu memakai nilai provider asli, bukan hasil konversi mata uang tampilan.</p></form>';
 openModal(TOOL_CATALOG[t]?.label||'Drawing settings',body,root=>{
  const form=root.querySelector('#drawingSettingsForm');
  const el=k=>form.querySelector('[data-setting="'+k+'"]');
  const val=k=>el(k)?.value;
  const checked=k=>el(k)?.checked===true;
  function read(){
   if(!form.checkValidity())throw Error('Isian pengaturan belum valid');
   const result=clone(d);result.style=normalizeStyle(t,{color:val('color'),fill:val('fill'),width:Number(val('width')),opacity:Number(val('opacity')),dash:val('dash'),extend:checked('extend')});
   result.text=val('text')||'';result.locked=checked('locked');result.hidden=checked('hidden');
   for(const k of ['a','b','c'])if(el('price-'+k)){
    const price=Number(val('price-'+k)),time=val('time-'+k)===tf(d[k].time)?d[k].time:Date.parse(val('time-'+k)+'Z')/1000;
    if(!Number.isFinite(price)||!Number.isFinite(time))throw Error('Koordinat harga/waktu tidak valid');
    result[k]={...result[k],price,time};
   }
   if(TOOL_CATALOG[t].points===1)result.b={...result.a};
   if(el('levels')){const raw=val('levels').split(',').map(x=>x.trim()).filter(Boolean).map(Number);if(!raw.length||raw.some(x=>!Number.isFinite(x)||x< -10||x>20)||raw.length>24)throw Error('Masukkan maksimal 24 level valid (-10 sampai 20)');result.levels=normalizeLevels(raw,t)}
   if(isPosition(t))result.risk=normalizeRisk({balance:Number(val('balance')),percent:Number(val('riskPercent')),contract:Number(val('contract'))});
   const fixed=normalizeDrawing(result,layer.chart.candles);if(!fixed)throw Error('Koordinat tidak valid. Untuk posisi, TP dan SL harus di sisi berlawanan dari entry.');
   return fixed;
  }
  function apply(template=false){try{const next=read();if(!layer.update(id,next))throw Error('Objek tidak tersedia atau tidak valid');if(template)layer.saveTemplate(next);closeModal();toast(template?'Pengaturan dan default tool disimpan':'Drawing diperbarui','success')}catch(e){toast(e.message,'error')}}
  form.onsubmit=e=>{e.preventDefault();apply()};
  root.querySelector('#drawingTemplateSave').onclick=()=>apply(true);
  if(isPosition(t))form.oninput=()=>{const node=root.querySelector('#drawingRiskSummary');try{node.textContent=summary(read())}catch(e){node.textContent=e.message}};
 });
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Gagal memuat layer snapshot'));img.src=src})}
export async function composeChartSnapshot(chart,layers=[]){
 const base=await loadImage(chart.screenshot()),canvas=document.createElement('canvas');canvas.width=base.naturalWidth;canvas.height=base.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(base,0,0);
 for(const layer of layers){
  if(!layer||!layer.childNodes.length||getComputedStyle(layer).display==='none')continue;
  const copy=layer.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  copy.querySelectorAll('[data-handle]').forEach(x=>x.remove());copy.querySelectorAll('[stroke="var(--deep,#090b0e)"]').forEach(x=>x.setAttribute('stroke',document.body.dataset.theme==='light'?'#ffffff':'#090b0e'));
  if(!copy.hasAttribute('viewBox'))copy.setAttribute('viewBox','0 0 '+layer.clientWidth+' '+layer.clientHeight);
  copy.setAttribute('width',String(layer.clientWidth));copy.setAttribute('height',String(layer.clientHeight));
  const uri=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}));
  try{const img=await loadImage(uri);ctx.drawImage(img,0,0,canvas.width,canvas.height)}finally{URL.revokeObjectURL(uri)}
 }
 return canvas.toDataURL('image/png');
}
