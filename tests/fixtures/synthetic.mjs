// Synthetic fixtures FOR TESTS ONLY. Never imported by the market gateway or frontend.
const PERIODS={'1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,'1h':3600,'2h':7200,'4h':14400,'1d':86400,'1w':604800};
export function seededDemo(symbol='BTCUSDT',tf='1h',count=600){
 // Explicitly synthetic and reproducible, never passed off as real market data.
 const interval=PERIODS[tf]||3600;
 let seed=2166136261;for(const c of symbol+tf){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619)}
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const base=({BTCUSDT:93250,XAUUSD:4050,EURUSD:1.16})[symbol]??100;
 const end=Math.floor(Date.now()/1000/interval)*interval;
 const vol=interval<=300?.003:interval<=3600?.008:interval<=14400?.014:.025;
 let price=base*(.87+rand()*.22);
 const arr=[];
 for(let i=0;i<count;i++){
  const time=end-(count-1-i)*interval;
  const open=price;
  let shock=(rand()-.48)*vol+Math.sin(i/27)*vol*.11;
  price=Math.max(base*.12,price*(1+shock));
  const close=price,high=Math.max(open,close)*(1+rand()*vol*.40),low=Math.min(open,close)*(1-rand()*vol*.36);
  arr.push({time,open,high,low,close,volume:Math.round(500+rand()*3000)});
 }
 return arr;
}
