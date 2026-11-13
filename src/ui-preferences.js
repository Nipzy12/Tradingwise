// Tradingwise UI preferences v0.8. Pure helpers are also used by node:test.
// All preferences are per-browser; no secrets or broker OAuth data are persisted here.
export const UI_PREF_KEY='tradingwise-ui-v08';
const symbolPattern=/^(?:BINANCE|BIQUOTE):[A-Z0-9_.-]{1,64}$|^CTRADER:\d{1,20}:\d{1,20}$/;
const TOOL_IDS=['trend','horizontal','vertical','rectangle','fibo','text','long','short','ruler'];
const INDICATOR_IDS=['smc-entry-pro-v5','ema9','ema21','sma20','bb','vwap','volume','rsi','macd'];
export const TIMEFRAMES=['1m','3m','5m','15m','30m','1h','2h','4h','1d','1w'];
export const DEFAULT_UI_PREFS=Object.freeze({
 favorites:{
  symbols:['BIQUOTE:XAUUSD','BINANCE:BTCUSDT'],
  timeframes:['5m','15m','1h','4h','1d'],
  tools:['trend','horizontal','rectangle'],
  indicators:['ema9','ema21']
 },
 settings:{
  grid:true,crosshair:true,lastPrice:true,legend:true,watermark:false,
  barSpacing:8,rightOffset:7,priceScale:'normal',
  upColor:'#089981',downColor:'#f23645'
 },
 watchlistSort:'manual',
 showFavoritesBar:true,
 panelCollapsed:true,
 sidebarCollapsed:true
});
const safeList=(items,validate,max=80)=>{
 if(!Array.isArray(items))return [];
 return [...new Set(items.filter(x=>typeof x==='string'&&validate(x)))].slice(0,max);
};
const bool=(value,fallback)=>typeof value==='boolean'?value:fallback;
const numeric=(value,fallback,min,max)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():fallback;
export function normalizeUiPreferences(input={}){
 const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const favorites=raw.favorites&&typeof raw.favorites==='object'?raw.favorites:{};
 const settings=raw.settings&&typeof raw.settings==='object'?raw.settings:{};
 const defaults=DEFAULT_UI_PREFS;
 const pick=(name,valid,max)=>name in favorites?safeList(favorites[name],valid,max):[...defaults.favorites[name]];
 return {
  favorites:{
   symbols:pick('symbols',x=>symbolPattern.test(x),80),
   timeframes:pick('timeframes',x=>TIMEFRAMES.includes(x),10),
   tools:pick('tools',x=>TOOL_IDS.includes(x),TOOL_IDS.length),
   indicators:pick('indicators',x=>INDICATOR_IDS.includes(x),INDICATOR_IDS.length)
  },
  settings:{
   grid:bool(settings.grid,defaults.settings.grid),
   crosshair:bool(settings.crosshair,defaults.settings.crosshair),
   lastPrice:bool(settings.lastPrice,defaults.settings.lastPrice),
   legend:bool(settings.legend,defaults.settings.legend),
   watermark:bool(settings.watermark,defaults.settings.watermark),
   barSpacing:numeric(settings.barSpacing,defaults.settings.barSpacing,3,22),
   rightOffset:numeric(settings.rightOffset,defaults.settings.rightOffset,0,35),
   priceScale:['normal','logarithmic','percentage'].includes(settings.priceScale)?settings.priceScale:defaults.settings.priceScale,
   upColor:color(settings.upColor,defaults.settings.upColor),
   downColor:color(settings.downColor,defaults.settings.downColor)
  },
  watchlistSort:['manual','symbol','favorites','change'].includes(raw.watchlistSort)?raw.watchlistSort:'manual',
  showFavoritesBar:bool(raw.showFavoritesBar,true),
  panelCollapsed:bool(raw.panelCollapsed,true),
  sidebarCollapsed:bool(raw.sidebarCollapsed,true)
 };
}
export function readUiPreferences(storage){
 try{return normalizeUiPreferences(JSON.parse(storage?.getItem(UI_PREF_KEY)||'{}'))}
 catch{return normalizeUiPreferences()}
}
export function writeUiPreferences(storage,data){
 const normalized=normalizeUiPreferences(data);
 try{storage?.setItem(UI_PREF_KEY,JSON.stringify(normalized))}catch{}
 return normalized;
}
export function hasFavorite(pref,kind,value){return Boolean(pref?.favorites?.[kind]?.includes(value))}
export function toggleFavorite(pref,kind,value){
 if(!['symbols','timeframes','tools','indicators'].includes(kind))throw Error('Invalid favorites collection');
 const normalized=normalizeUiPreferences(pref);
 const current=normalized.favorites[kind];
 if(current.includes(value))normalized.favorites[kind]=current.filter(x=>x!==value);
 else {
  const valid=normalizeUiPreferences({favorites:{[kind]:[value]}}).favorites[kind];
  if(valid.length!==1)throw Error('Invalid favorite value');
  normalized.favorites[kind]=[...current,value];
 }
 return normalized;
}
export function orderWatchlist(ids,mode='manual',favorites=[],changes={}){
 const unique=[...new Set(Array.isArray(ids)?ids:[])];
 if(mode==='symbol')return unique.sort((a,b)=>a.localeCompare(b));
 if(mode==='favorites')return unique.sort((a,b)=>Number(favorites.includes(b))-Number(favorites.includes(a)));
 if(mode==='change')return unique.sort((a,b)=>{
  const aa=Number(changes[a]),bb=Number(changes[b]);
  return (Number.isFinite(bb)?bb:-Infinity)-(Number.isFinite(aa)?aa:-Infinity)
 });
 return unique;
}
