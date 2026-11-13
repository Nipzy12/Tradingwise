import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MarketCatalog,DEFAULT_BASES,parseMarketId,readCandles,readTickers,validateInterval} from './providers.mjs';
import {BinanceStreams,BiquoteHub} from './streams.mjs';
import {websocketUpgrade} from './ws-server.mjs';
import {AlertEngine,authenticate,SMC_ALERT_TYPES} from './alerts.mjs';
import {AlertStore} from './alert-store.mjs';

const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.pine':'text/plain; charset=utf-8'};
const CONFIG={...DEFAULT_BASES};for(const name of Object.keys(DEFAULT_BASES))if(process.env[name])CONFIG[name]=process.env[name].replace(/\/$/,'');
export function buildServer({fetchFn=fetch,WebSocketImpl=WebSocket,bases=CONFIG,root=ROOT,alertOptions={}}={}){
 const catalog=new MarketCatalog({fetchFn,bases});const binance=new BinanceStreams({WebSocketImpl,bases});const biquote=new BiquoteHub({fetchFn,WebSocketImpl,bases});const sessions=new Set();
 const alerts=new AlertEngine({catalog,binance,biquote,fetchFn,bases,store:new AlertStore(process.env.ALERT_STORE_PATH||join(root,'data','alerts.json')),adminToken:process.env.ALERT_ADMIN_TOKEN||'',webhookUrl:process.env.ALERT_WEBHOOK_URL||'',secret:process.env.ALERT_WEBHOOK_SECRET||'',...alertOptions});
 const server=createServer(async(req,res)=>{
  const reply=(status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(payload))};
  try{
   const url=new URL(req.url,'http://localhost');const path=url.pathname;
   if(path.startsWith('/api/alerts')){
    if(!alerts.adminToken){reply(503,{error:'Set ALERT_ADMIN_TOKEN on server to enable protected alert API'});return}
    if(!authenticate(req,alerts.adminToken)){res.setHeader('www-authenticate','Bearer realm="LUMAVUN alerts"');reply(401,{error:'Bearer token required'});return}
    if(!alerts.started){reply(503,{error:'Alert engine is initializing'});return}
    if(req.method==='GET'&&path==='/api/alerts/status'){reply(200,{...alerts.status(),eventTypes:SMC_ALERT_TYPES});return}
    if(req.method==='GET'&&path==='/api/alerts/rules'){reply(200,{items:alerts.listRules()});return}
    if(req.method==='GET'&&path==='/api/alerts/events'){reply(200,{items:alerts.listEvents()});return}
    if(req.method==='DELETE'&&/^\/api\/alerts\/rules\/[0-9a-f-]{36}$/.test(path)){await alerts.deleteRule(path.split('/').at(-1));reply(200,{ok:true});return}
    if(req.method==='POST'&&(path==='/api/alerts/rules'||path==='/api/alerts/test')){
     const chunks=[];let size=0;
     for await(const chunk of req){size+=chunk.length;if(size>32768){reply(413,{error:'Request body exceeds 32 KB'});return}chunks.push(chunk)}
     let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{reply(400,{error:'Invalid JSON'});return}
     if(path==='/api/alerts/test'){const outcome=await alerts.sendTest();reply(200,outcome);return}
     if(!body||typeof body!=='object'||Array.isArray(body)){reply(400,{error:'Invalid alert rule'});return}
     const rule=await alerts.createRule(body);reply(201,{item:rule});return;
    }
    reply(404,{error:'Unknown alert API endpoint'});return;
   }
   if(req.method!=='GET'){reply(405,{error:'Only GET supported'});return}
   if(path==='/api/market/health'){reply(200,{ok:true,binance:{status:[...binance.feeds.values()].map(f=>({id:f.id,interval:f.interval,status:f.status}))},biquote:{status:biquote.status,subscriptions:biquote.listeners.size},catalog:{counts:Object.fromEntries([...catalog.cache].map(([p,c])=>[p,c.items.length])),errors:Object.fromEntries(catalog.errors)}});return}
   if(path==='/api/market/symbols'){
    const provider=String(url.searchParams.get('provider')||'ALL').toUpperCase();const q=(url.searchParams.get('q')||'').slice(0,100);
    const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||70)),offset=Math.max(0,Math.min(10000,Number(url.searchParams.get('offset'))||0));
    const result=await catalog.search({provider,q,limit,offset});reply(Object.keys(result.errors).length===2||provider!=='ALL'&&Object.keys(result.errors).length?503:200,result);return
   }
   if(path==='/api/market/candles'){
    const id=url.searchParams.get('symbol')||'',interval=url.searchParams.get('interval')||'1h',limit=Math.max(30,Math.min(1000,Number(url.searchParams.get('limit'))||650));
    const result=await readCandles({id,interval,limit,catalog,fetchFn,bases});reply(200,result);return;
   }
   if(path==='/api/market/tickers'){
    const ids=(url.searchParams.get('symbols')||'').split(',').filter(Boolean);if(ids.length>60){reply(400,{error:'Max 60 symbols'});return}
    for(const id of ids){parseMarketId(id)}const result=await readTickers({ids,catalog,fetchFn,bases});reply(result.errors.length&&!result.items.length?502:200,result);return;
   }
   if(path.startsWith('/api/')){reply(404,{error:'Endpoint not found'});return}
   if(path==='/'){res.writeHead(302,{location:'/index.html'});res.end();return}
   const decoded=decodeURIComponent(path);
   // Serve only public UI assets. Never expose .env, server source, data/alerts.json, or tests.
   if(!(decoded==='/index.html'||decoded.startsWith('/src/')||decoded.startsWith('/assets/')||decoded==='/favicon.ico')){reply(403,{error:'Static path is not public'});return}
   const full=resolve(root,'.'+decoded);
   if(!full.startsWith(root+sep)||decoded.includes('\0')){reply(403,{error:'Forbidden'});return}
   const item=await stat(full).catch(()=>null);if(!item?.isFile()){reply(404,{error:'Not found'});return}
   const bytes=await readFile(full);res.writeHead(200,{'content-type':MIME[extname(full)]||'application/octet-stream','cache-control':/\.(js|css|html)$/.test(full)?'no-cache':'public,max-age=3600','x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'self'"});res.end(bytes);
  }catch(e){const status=[400,401,403,404,413,429,503].includes(e.status)?e.status:502;reply(status,{error:String(e.message||'Market provider error').slice(0,200)})}
 });
 server.on('listening',()=>{void alerts.start().catch(e=>console.error('Alert store startup failed:',e.message))});
 server.on('upgrade',(req,socket,head)=>{
  if(req.url?.split('?')[0]!=='/ws/market'){socket.destroy();return}
  websocketUpgrade(req,socket,head,session=>{
   sessions.add(session);let dispose=null,revision=0;
   session.onClose=()=>{revision++;dispose?.();dispose=null;sessions.delete(session)};
   session.onMessage=async msg=>{
    if(!msg||typeof msg!=='object'){session.send({type:'error',message:'Invalid command'});return}
    if(msg.action==='unsubscribe'){revision++;dispose?.();dispose=null;session.send({type:'status',status:'unsubscribed'});return}
    if(msg.action!=='subscribe'){session.send({type:'error',message:'Expected subscribe'});return}
    const rev=++revision;dispose?.();dispose=null;
    try{
     const {id,provider}=parseMarketId(msg.symbol),interval=String(msg.interval||'1h');validateInterval(provider,interval);await catalog.lookup(id);
     if(rev!==revision)return;
     const emit=packet=>{if(rev===revision)session.send(packet)};
     dispose=provider==='BINANCE'?binance.subscribe(id,interval,emit):biquote.subscribe(id,emit);
    }catch(e){if(rev===revision)session.send({type:'error',message:e.message,request:msg.symbol})}
   };
   session.send({type:'hello',message:'LUMAVUN WebSocket market gateway',version:1});
  });
 });
 return {server,catalog,binance,biquote,alerts,close:async()=>{for(const s of sessions)s.close();await alerts.close();binance.close();biquote.close();await new Promise(resolve=>server.close(resolve))}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8000);const app=buildServer();app.server.listen(port,host,()=>console.log(`LUMAVUN Market Gateway http://${host}:${port} (Node 22+, no API key needed)`));
 const exit=()=>app.close().then(()=>process.exit(0));process.on('SIGINT',exit);process.on('SIGTERM',exit);
}
