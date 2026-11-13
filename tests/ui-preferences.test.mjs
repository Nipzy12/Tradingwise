import test from 'node:test';
import assert from 'node:assert/strict';
import {
 UI_PREF_KEY,DEFAULT_UI_PREFS,TIMEFRAMES,
 normalizeUiPreferences,hasFavorite,toggleFavorite,
 orderWatchlist,readUiPreferences,writeUiPreferences
} from '../src/ui-preferences.js';

test('defaults provide functional pinned symbol, timeframe, tool and indicator collections',()=>{
 const p=normalizeUiPreferences();
 assert.equal(p.settings.grid,true);
 assert.equal(p.panelCollapsed,true);
 assert.ok(hasFavorite(p,'symbols','BINANCE:BTCUSDT'));
 assert.ok(hasFavorite(p,'timeframes','1h'));
 assert.ok(hasFavorite(p,'tools','trend'));
 assert.ok(hasFavorite(p,'indicators','ema9'));
 assert.equal(p.favorites.timeframes.every(x=>TIMEFRAMES.includes(x)),true);
});
test('favorite toggle retains all other saved preferences and deduplicates',()=>{
 const before=normalizeUiPreferences();
 const after=toggleFavorite(before,'symbols','BINANCE:ETHUSDT');
 assert.ok(hasFavorite(after,'symbols','BINANCE:ETHUSDT'));
 assert.ok(!hasFavorite(before,'symbols','BINANCE:ETHUSDT'));
 const removed=toggleFavorite(after,'symbols','BINANCE:ETHUSDT');
 assert.ok(!hasFavorite(removed,'symbols','BINANCE:ETHUSDT'));
 assert.deepEqual(removed.settings,before.settings);
 assert.throws(()=>toggleFavorite(before,'tools','<script>'),/Invalid/);
 assert.throws(()=>toggleFavorite(before,'unknown','anything'),/Invalid/);
});
test('saved preferences validate user-controlled inputs, colors, numbers and IDs',()=>{
 const p=normalizeUiPreferences({
  favorites:{symbols:['BINANCE:BTCUSDT','BINANCE:BTCUSDT','<script>','CTRADER:111:222'],tools:['trend','evil'],timeframes:['1h','99h'],indicators:['ema9','__proto__']},
  settings:{grid:false,barSpacing:999,rightOffset:-10,upColor:'red',downColor:'#AABBCC',priceScale:'unsafe'},
  watchlistSort:'bad',panelCollapsed:false
 });
 assert.deepEqual(p.favorites.symbols,['BINANCE:BTCUSDT','CTRADER:111:222']);
 assert.deepEqual(p.favorites.tools,['trend']);
 assert.deepEqual(p.favorites.timeframes,['1h']);
 assert.deepEqual(p.favorites.indicators,['ema9']);
 assert.equal(p.settings.grid,false);
 assert.equal(p.settings.barSpacing,22);
 assert.equal(p.settings.rightOffset,0);
 assert.equal(p.settings.upColor,DEFAULT_UI_PREFS.settings.upColor);
 assert.equal(p.settings.downColor,'#aabbcc');
 assert.equal(p.settings.priceScale,'normal');
 assert.equal(p.watchlistSort,'manual');
 assert.equal(p.panelCollapsed,false);
});
test('per-browser storage preserves layout, sorting and colors without broker credentials',()=>{
 const m=new Map();
 const storage={getItem:key=>m.get(key)||null,setItem:(key,value)=>m.set(key,value)};
 const pref=normalizeUiPreferences();
 pref.settings.grid=false;
 pref.settings.upColor='#00ff88';
 pref.watchlistSort='favorites';
 pref.sidebarCollapsed=false;
 const saved=writeUiPreferences(storage,pref);
 const restored=readUiPreferences(storage);
 assert.deepEqual(saved,restored);
 assert.ok(m.has(UI_PREF_KEY));
 assert.doesNotMatch(m.get(UI_PREF_KEY),/CTRADER_CLIENT_SECRET|accessToken|refreshToken/);
});
test('malformed localStorage never prevents chart loading',()=>{
 const storage={getItem:()=>'{bad-json',setItem:()=>{throw Error('storage disabled')}};
 assert.deepEqual(readUiPreferences(storage),normalizeUiPreferences());
 assert.doesNotThrow(()=>writeUiPreferences(storage,normalizeUiPreferences()));
});
test('watchlist sorts manual/favorites/symbol/change without mutating source order',()=>{
 const a=['BIQUOTE:XAUUSD','BINANCE:BTCUSDT','BINANCE:ETHUSDT'];
 const before=[...a];
 assert.deepEqual(orderWatchlist(a,'manual',[]),a);
 assert.deepEqual(orderWatchlist(a,'favorites',['BINANCE:ETHUSDT']),['BINANCE:ETHUSDT','BIQUOTE:XAUUSD','BINANCE:BTCUSDT']);
 assert.deepEqual(orderWatchlist(a,'symbol',[]),['BINANCE:BTCUSDT','BINANCE:ETHUSDT','BIQUOTE:XAUUSD']);
 assert.deepEqual(orderWatchlist(a,'change',[],{'BIQUOTE:XAUUSD':-2,'BINANCE:BTCUSDT':4,'BINANCE:ETHUSDT':-1}),['BINANCE:BTCUSDT','BINANCE:ETHUSDT','BIQUOTE:XAUUSD']);
 assert.deepEqual(a,before);
});
