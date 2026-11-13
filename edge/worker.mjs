// Tradingwise edge market gateway. Read-only, no simulated market data.
import {MarketCatalog,DEFAULT_BASES,parseMarketId,validateInterval,readCandles,readTickers,candleFromBinance,tickFromBiquote} from '../server/providers.mjs';
const catalog=new MarketCatalog({ttlMs:300000});
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const bases=env=>({...DEFAULT_BASES,...Object.fromEntries(Object.keys(DEFAULT_BASES).filter(k=>env[k]).map(k=>[k,env[k]]))});
const bad=(message,status=400)=>reply({error:message},status);
const cors=(request,response,env)=>{const o=request.headers.get('origin');const custom=env.ALLOWED_ORIGIN;if(o&&(o===custom||/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(o)||/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i.test(o))){response.headers.set('access-control-allow-origin',o);response.headers.set('vary','Origin');response.headers.set('access-control-allow-methods','GET, OPTIONS');response.headers.set('access-control-allow-headers','Accept,Content-Type');}return response;};
async function market(path,params,env){
 const b=bases(env);
 if(path==='/api/market/health')return reply({ok:true,mode:'workers-free',source:'public provider APIs',synthetic:false,alerts:'node-backend-required'});
 if(path==='/api/market/symbols'){
  const p=String(params.get('provider')||'ALL').toUpperCase(),q=String(params.get('q')||'').slice(0,100),limit=Math.max(1,Math.min(100,Number(params.get('limit'))||70)),offset=Math.max(0,Math.min(10000,Number(params.get('offset'))||0));
  const data=await catalog.search({provider:p,q,limit,offset});const failures=Object.keys(data.errors).length;
  return reply(data,failures&&(p!=='ALL'||failures===2)?503:200);
 }
 if(path==='/api/market/candles'){
  const id=params.get('symbol')||'',interval=params.get('interval')||'1h',limit=Math.max(30,Math.min(1000,Number(params.get('limit'))||650));
  return reply(await readCandles({id,interval,limit,catalog,bases:b}));
 }
 if(path==='/api/market/tickers'){
  const ids=(params.get('symbols')||'').split(',').filter(Boolean);if(ids.length>60)return bad('Max 60 symbols');
  ids.forEach(parseMarketId);return reply(await readTickers({ids,catalog,bases:b}));
 }
 return bad('Unknown API',404);
}
const send=(ws,o)=>{try{ws.send(JSON.stringify(o))}catch{}};
const close=ws=>{try{ws?.close()}catch{}};
async function openUpstream(url){
 const u=new URL(url);u.protocol=u.protocol==='wss:'?'https:':'http:';
 const res=await fetch(u.toString(),{headers:{Upgrade:'websocket'}});
 if(!res.webSocket)throw Error('WebSocket upstream refused '+res.status);
 res.webSocket.accept();return res.webSocket;
}
async function socket(request,env){
 if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return bad('WebSocket upgrade required',426);
 const sockets=new WebSocketPair(),client=sockets[0],server=sockets[1];server.accept();
 let remote=null,done=false,subscribed=false,buffer='';
 const finish=()=>{if(done)return;done=true;close(remote);close(server)};
 server.addEventListener('close',finish);server.addEventListener('error',finish);
 server.addEventListener('message',async e=>{
  if(done||subscribed)return;
  if(typeof e.data!=='string'||e.data.length>8192){finish();return;}
  let msg;try{msg=JSON.parse(e.data)}catch{return;}
  if(msg.action!=='subscribe')return;
  subscribed=true;
  try{
   const {id,provider,symbol}=parseMarketId(msg.symbol),interval=String(msg.interval||'1h');
   validateInterval(provider,interval);await catalog.lookup(id);
   const b=bases(env);
   if(provider==='BINANCE'){
    remote=await openUpstream(b.BINANCE_WS+'/ws/'+symbol.toLowerCase()+'@kline_'+interval);
    remote.addEventListener('message',e=>{try{const c=candleFromBinance(JSON.parse(String(e.data)));if(c?.id===id&&c.interval===interval)send(server,c)}catch{}});
    send(server,{type:'status',id,status:'connected'});
   }else{
    const nr=await fetch(b.BIQUOTE_HUB+'/negotiate?negotiateVersion=1',{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:''});
    if(!nr.ok)throw Error('SignalR negotiate HTTP '+nr.status);
    const j=await nr.json(),token=j.connectionToken||j.connectionId;if(!token)throw Error('Missing SignalR token');
    const u=new URL(b.BIQUOTE_HUB);u.protocol=u.protocol==='https:'?'wss:':'ws:';u.searchParams.set('id',token);
    remote=await openUpstream(u.toString());
    remote.send('{"protocol":"json","version":1}\x1e');
    remote.addEventListener('message',e=>{
     buffer+=String(e.data);if(buffer.length>102400){finish();return;}
     const parts=buffer.split('\x1e');buffer=parts.pop()||'';
     for(const part of parts){if(!part)continue;let m;try{m=JSON.parse(part)}catch{continue;}
      if(!Object.hasOwn(m,'type')){if(m.error){send(server,{type:'error',message:'SignalR rejected'});finish();return;}remote.send(JSON.stringify({type:1,target:'Subscribe',arguments:[[symbol]]})+'\x1e');send(server,{type:'status',id,status:'connected'});}
      else if(m.type===1&&m.target==='ReceiveTick'){const tick=tickFromBiquote(m.arguments?.[0]);if(tick?.id===id)send(server,tick);}
      else if(m.type===7)finish();
     }
    });
   }
   remote.addEventListener('close',finish);remote.addEventListener('error',finish);if(done)close(remote);
  }catch(e){send(server,{type:'error',message:String(e.message||e).slice(0,180)});finish()}
 });
 return new Response(null,{status:101,webSocket:client});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}),env);
  if(path==='/ws/market')return socket(request,env);
  if(path.startsWith('/api/alerts/'))return cors(request,bad('Persistent SMC alerts require always-on Node backend. Edge mode is public market-data only.',503),env);
  if(!path.startsWith('/api/market/'))return cors(request,bad('Not Found',404),env);
  if(request.method!=='GET')return cors(request,bad('Only GET supported',405),env);
  try{return cors(request,await market(path,url.searchParams,env),env)}
  catch(e){return cors(request,bad(String(e.message||e),e.status>=400&&e.status<600?e.status:502),env)}
 }
};