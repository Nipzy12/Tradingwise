import {parseMarketId,validateInterval,candleFromBinance,tickFromBiquote,DEFAULT_BASES} from './providers.mjs';

export class BinanceStreams {
 constructor({WebSocketImpl=WebSocket,bases=DEFAULT_BASES}={}){this.WS=WebSocketImpl;this.bases=bases;this.feeds=new Map()}
 subscribe(id,interval,listener){
  const {provider,symbol}=parseMarketId(id);if(provider!=='BINANCE')throw Error('Binance stream requires BINANCE ID');validateInterval(provider,interval);
  const key=`${id}:${interval}`;let feed=this.feeds.get(key);
  if(!feed){feed={key,id,interval,symbol,clients:new Set(),ws:null,delay:1000,closing:false,timer:null,status:'connecting'};this.feeds.set(key,feed);this.connect(feed)}
  clearTimeout(feed.timer);feed.clients.add(listener);listener({type:'status',id,provider:'BINANCE',status:feed.status});
  return ()=>{feed.clients.delete(listener);if(!feed.clients.size){feed.closing=true;clearTimeout(feed.timer);feed.ws?.close();this.feeds.delete(key)}};
 }
 connect(feed){
  if(feed.closing||!this.feeds.has(feed.key))return;
  feed.status='connecting';const url=`${this.bases.BINANCE_WS}/ws/${feed.symbol.toLowerCase()}@kline_${feed.interval}`;
  let ws;
  try{ws=new this.WS(url)}catch(e){this.reconnect(feed,e.message);return}
  feed.ws=ws;
  ws.addEventListener('open',()=>{feed.delay=1000;feed.status='connected';this.emit(feed,{type:'status',id:feed.id,provider:'BINANCE',status:'connected'})});
  ws.addEventListener('message',ev=>{try{const event=candleFromBinance(JSON.parse(String(ev.data)));if(event&&event.id===feed.id&&event.interval===feed.interval)this.emit(feed,event)}catch{}});
  ws.addEventListener('error',()=>{feed.status='reconnecting';this.emit(feed,{type:'status',id:feed.id,provider:'BINANCE',status:'reconnecting'})});
  ws.addEventListener('close',()=>{if(feed.closing)return;this.reconnect(feed,'Binance WebSocket disconnected')});
 }
 emit(feed,packet){for(const cb of feed.clients){try{cb(packet)}catch{}}}
 reconnect(feed,reason){if(feed.closing||!feed.clients.size)return;feed.status='reconnecting';this.emit(feed,{type:'status',id:feed.id,provider:'BINANCE',status:'reconnecting',reason});clearTimeout(feed.timer);feed.timer=setTimeout(()=>this.connect(feed),feed.delay);feed.delay=Math.min(feed.delay*2,30000)}
 close(){for(const f of this.feeds.values()){f.closing=true;clearTimeout(f.timer);f.ws?.close()}this.feeds.clear()}
}

// Biquote implements Microsoft SignalR JSON over WebSocket. One shared connection
// subscribes to all requested quote symbols and fans out ticks to each client.
export class BiquoteHub {
 constructor({fetchFn=fetch,WebSocketImpl=WebSocket,bases=DEFAULT_BASES}={}){
  this.fetchFn=fetchFn;this.WS=WebSocketImpl;this.bases=bases;this.listeners=new Map();this.ws=null;this.ready=false;this.connecting=false;this.stopped=false;this.buffer='';this.delay=1000;this.timer=null;this.status='disconnected';this.sequence=0;
 }
 subscribe(id,listener){
  const {provider,symbol}=parseMarketId(id);if(provider!=='BIQUOTE')throw Error('Biquote subscription requires BIQUOTE ID');
  if(!this.listeners.has(symbol))this.listeners.set(symbol,new Set());this.listeners.get(symbol).add(listener);
  listener({type:'status',id,provider:'BIQUOTE',status:this.status});
  if(this.ready)this.sendInvocation('Subscribe',[symbol]);else this.connect();
  return ()=>{const set=this.listeners.get(symbol);set?.delete(listener);if(set&&!set.size){this.listeners.delete(symbol);if(this.ready)this.sendInvocation('Unsubscribe',[symbol])}if(!this.listeners.size)this.closeIdle()};
 }
 async connect(){
  if(this.stopped||this.connecting||this.ws||!this.listeners.size)return;
  this.connecting=true;this.status='connecting';this.broadcastStatus();
  try{
   const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12000);
   let response;
   try{response=await this.fetchFn(`${this.bases.BIQUOTE_HUB}/negotiate?negotiateVersion=1`,{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:'',signal:ctl.signal})}
   finally{clearTimeout(timeout)}
   if(!response.ok)throw Error(`SignalR negotiation HTTP ${response.status}`);
   const payload=await response.json();
   if(payload.error)throw Error('SignalR negotiation rejected');
   const token=payload.connectionToken||payload.connectionId;
   if(!token)throw Error('SignalR negotiate missing connection token');
   if(!this.listeners.size){this.connecting=false;return}
   const hub=new URL(this.bases.BIQUOTE_HUB);hub.protocol=hub.protocol==='https:'?'wss:':'ws:';hub.searchParams.set('id',token);
   const ws=new this.WS(hub.toString());this.ws=ws;this.buffer='';this.ready=false;
   ws.addEventListener('open',()=>{ws.send('{"protocol":"json","version":1}\x1e')});
   ws.addEventListener('message',ev=>this.handleMessage(String(ev.data)));
   ws.addEventListener('error',()=>{this.status='reconnecting';this.broadcastStatus()});
   ws.addEventListener('close',()=>{if(this.ws!==ws)return;this.ws=null;this.ready=false;this.connecting=false;this.schedule()});
  }catch(e){this.connecting=false;this.status='reconnecting';this.broadcastStatus(e.message);this.schedule()}
 }
 handleMessage(data){
  this.buffer+=data;if(this.buffer.length>1024*1024){this.ws?.close();return}
  const chunks=this.buffer.split('\x1e');this.buffer=chunks.pop()||'';
  for(const part of chunks){if(!part)continue;let msg;try{msg=JSON.parse(part)}catch{continue}
   if(!this.ready){
    if(msg.error){this.ws?.close();return}
    if(!Object.hasOwn(msg,'type')){this.ready=true;this.connecting=false;this.delay=1000;this.status='connected';this.broadcastStatus();this.sendInvocation('Subscribe',[...this.listeners.keys()]);continue}
   }
   if(msg.type===1&&msg.target==='ReceiveTick'&&Array.isArray(msg.arguments)){
    const tick=tickFromBiquote(msg.arguments[0]);if(tick){const set=this.listeners.get(String(tick.symbol).toUpperCase());for(const cb of set||[]){try{cb(tick)}catch{}}}
   }else if(msg.type===7){this.ws?.close()}
  }
 }
 sendInvocation(target,symbols){if(!this.ready||!this.ws||!symbols.length)return;this.ws.send(JSON.stringify({type:1,target,arguments:[symbols]})+'\x1e')}
 broadcastStatus(reason){for(const [symbol,set] of this.listeners)for(const cb of set){try{cb({type:'status',id:`BIQUOTE:${symbol}`,provider:'BIQUOTE',status:this.status,reason})}catch{}}}
 schedule(){if(this.stopped||!this.listeners.size)return;this.status='reconnecting';this.broadcastStatus();clearTimeout(this.timer);this.timer=setTimeout(()=>this.connect(),this.delay);this.delay=Math.min(this.delay*2,30000)}
 closeIdle(){clearTimeout(this.timer);this.timer=null;this.ws?.close();this.ws=null;this.ready=false;this.connecting=false;this.status='disconnected'}
 close(){this.stopped=true;this.closeIdle();this.listeners.clear()}
}
