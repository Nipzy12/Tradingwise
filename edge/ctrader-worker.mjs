// Tradingwise cTrader OAuth + broker data gateway (read-only).
// Environment: CTRADER_CLIENT_ID, CTRADER_CLIENT_SECRET, CTRADER_SESSION_KEY (base64 32 bytes),
// CTRADER_REDIRECT_URI, and D1 binding DB. Never store access/refresh tokens in client-side JS.
import {PROTO,TIMEFRAMES,normalizeTrendbars,ctraderId,parseCtraderId,lightSymbols} from './ctrader-protocol.mjs';
const PREFIX='/api/ctrader',COOKIE='tw_ctrader',STATE_COOKIE='tw_ctrader_state';
const SESSION_MS=14*86400000;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}});
const err=(message,status)=>json({error:message},status);
const getCookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(t=>t.trim()).filter(Boolean).map(t=>{const p=t.indexOf('=');return [t.slice(0,p),t.slice(p+1)]}));
const random=()=>{const a=crypto.getRandomValues(new Uint8Array(32));return b64url(a)};
const b64url=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=b=>Uint8Array.from(atob(b.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-b.length%4)%4)),ch=>ch.charCodeAt(0));
const safeEqual=(a,b)=>{const x=new TextEncoder().encode(String(a)),y=new TextEncoder().encode(String(b));let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);return d===0};
const hash=async s=>b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
const encKey=async env=>crypto.subtle.importKey('raw',decode(env.CTRADER_SESSION_KEY),'AES-GCM',false,['encrypt','decrypt']);
async function encrypt(env,value){const iv=crypto.getRandomValues(new Uint8Array(12)),buf=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encKey(env),new TextEncoder().encode(JSON.stringify(value)));return b64url(iv)+'.'+b64url(new Uint8Array(buf));}
async function decrypt(env,value){const [v,c]=String(value).split('.');if(!v||!c)throw Error('Corrupt session');const buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(v)},await encKey(env),decode(c));return JSON.parse(new TextDecoder().decode(buf));}
const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
function config(env){return Boolean(env.CTRADER_CLIENT_ID&&env.CTRADER_CLIENT_SECRET&&env.CTRADER_SESSION_KEY&&env.CTRADER_REDIRECT_URI&&env.DB)}
// Run before redirecting users: avoid consuming a 60-second OAuth code when storage or encryption is misconfigured.
async function readiness(env){
 const checks={sessionKey:false,database:false,redirectUri:false};
 if(!config(env))return checks;
 try{
  const u=new URL(env.CTRADER_REDIRECT_URI);
  checks.redirectUri=u.protocol==='https:'&&u.origin==='https://tradingwise.vercel.app'&&u.pathname===PREFIX+'/oauth/callback';
 }catch{}
 try{const raw=decode(env.CTRADER_SESSION_KEY);if(raw.byteLength===32){await encKey(env);checks.sessionKey=true}}catch{}
 try{await env.DB.prepare('SELECT 1 FROM ctrader_sessions LIMIT 1').all();checks.database=true}catch{}
 return checks;
}
const ready=x=>x.sessionKey&&x.database&&x.redirectUri;
const oauthMessage=Object.freeze({
 TOKEN_NETWORK_ERROR:'Gagal menghubungi server token cTrader; ulangi otorisasi.',
 TOKEN_REDIRECT_BLOCKED:'Endpoint cTrader mengembalikan redirect yang tidak diharapkan; pertukaran token dihentikan untuk keamanan.',
 TOKEN_INVALID_RESPONSE:'Respons server token cTrader tidak valid; ulangi otorisasi.',
 TOKEN_REJECTED:'cTrader menolak pertukaran kode OAuth. Cek kredensial aplikasi dan gunakan kode login baru (berlaku 60 detik).',
 TOKEN_MISSING_FIELDS:'Respons token cTrader tidak memiliki data autentikasi lengkap.',
 SESSION_STORE_FAILED:'Token diterima tetapi sesi tidak dapat disimpan. Periksa enkripsi dan database Cloudflare.',
 CALLBACK_FAILED:'Callback cTrader gagal pada backend. Ulangi otorisasi.',
 CONFIG_NOT_READY:'Konfigurasi enkripsi, database, atau Redirect URI belum siap.'
});
class OAuthFailure extends Error{
 constructor(code,extra){super(code);this.code=code;this.extra=extra||null}
}
function oauthError(code,status=502,extra){
 const body={error:oauthMessage[code]||oauthMessage.CALLBACK_FAILED,code};
 if(extra&&typeof extra.provider_code==='string'&&/^[A-Z][A-Z0-9_]{0,47}$/.test(extra.provider_code))body.provider_code=extra.provider_code;
 if(extra&&Number.isInteger(extra.provider_status)&&extra.provider_status>=400&&extra.provider_status<=599)body.provider_status=extra.provider_status;
 return json(body,status);
}
function secure(resp){resp.headers.set('cache-control','no-store, private');resp.headers.set('referrer-policy','no-referrer');resp.headers.set('x-content-type-options','nosniff');return resp}
async function saveSession(env,sid,tokens){
 const time=Date.now(),expiry=time+SESSION_MS;
 await env.DB.prepare('INSERT INTO ctrader_sessions(id_hash,token_ciphertext,access_expires_at,session_expires_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id_hash) DO UPDATE SET token_ciphertext=excluded.token_ciphertext,access_expires_at=excluded.access_expires_at,session_expires_at=excluded.session_expires_at,updated_at=excluded.updated_at')
 .bind(await hash(sid),await encrypt(env,tokens),tokens.expiresAt,expiry,time).run();
}
async function tokenRequest(env,params){
 const url=new URL('https://openapi.ctrader.com/apps/token');
 for(const [k,v] of Object.entries({...params,client_id:env.CTRADER_CLIENT_ID,client_secret:env.CTRADER_CLIENT_SECRET}))url.searchParams.set(k,v);
 let response;
 // Cloudflare Workers does not implement fetch redirect:"error": it throws a TypeError
 // even for HTTP 200. Manual mode prevents implicit forwarding of OAuth codes and secrets.
 try{response=await fetch(url,{headers:{accept:'application/json'},redirect:'manual'})}
 catch{throw new OAuthFailure('TOKEN_NETWORK_ERROR')}
 if(response.status>=300&&response.status<400)throw new OAuthFailure('TOKEN_REDIRECT_BLOCKED');
 let data;
 try{data=await response.json()}catch{throw new OAuthFailure('TOKEN_INVALID_RESPONSE')}
 const code=typeof data?.errorCode==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(data.errorCode)?data.errorCode.toUpperCase():undefined;
 if(!response.ok||data?.errorCode)throw new OAuthFailure('TOKEN_REJECTED',{provider_code:code,provider_status:response.status});
 if(typeof data?.accessToken!=='string'||typeof data?.refreshToken!=='string'||!data.accessToken||!data.refreshToken)throw new OAuthFailure('TOKEN_MISSING_FIELDS');
 const seconds=Number(data.expiresIn||2628000);
 return {accessToken:data.accessToken,refreshToken:data.refreshToken,expiresAt:Date.now()+(Number.isFinite(seconds)&&seconds>0?seconds:2628000)*1000};
}
async function currentSession(req,env){
 const sid=getCookies(req)[COOKIE];if(!sid||!/^[-_A-Za-z0-9]{35,80}$/.test(sid))return null;
 const id=await hash(sid);const row=await env.DB.prepare('SELECT token_ciphertext,access_expires_at,session_expires_at FROM ctrader_sessions WHERE id_hash=?').bind(id).first();
 if(!row||row.session_expires_at<Date.now())return null;
 let tokens;try{tokens=await decrypt(env,row.token_ciphertext)}catch{return null}
 if(tokens.expiresAt<Date.now()+180000){
  tokens=await tokenRequest(env,{grant_type:'refresh_token',refresh_token:tokens.refreshToken});
  await saveSession(env,sid,tokens);
 }
 return {sid,tokens};
}
function redirect(location,headers={}){return secure(new Response(null,{status:302,headers:{location,...headers}}))}
function oauthStart(env){
 const state=random(),url=new URL('https://id.ctrader.com/my/settings/openapi/grantingaccess/');
 for(const [k,v] of Object.entries({client_id:env.CTRADER_CLIENT_ID,redirect_uri:env.CTRADER_REDIRECT_URI,scope:'accounts',product:'web',state}))url.searchParams.set(k,v);
 return redirect(url.href,{'set-cookie':cookie(STATE_COOKIE,state,300)});
}
async function callback(req,env){
 const url=new URL(req.url),code=url.searchParams.get('code'),incoming=url.searchParams.get('state'),stored=getCookies(req)[STATE_COOKIE];
 // cTrader OAuth may not echo a custom state parameter on every server version. We require it, fail closed.
 if(!code||!incoming||!stored||!safeEqual(incoming,stored))return err('cTrader OAuth state validation failed. Restart authorization.',400);
 if(code.length>2048)return err('Authorization code too long',400);
 // Do not request a token until the session key, database and redirect URI pass preflight.
 if(!ready(await readiness(env)))return oauthError('CONFIG_NOT_READY',503);
 let tokens;
 try{tokens=await tokenRequest(env,{grant_type:'authorization_code',code,redirect_uri:env.CTRADER_REDIRECT_URI})}
 catch(e){return oauthError(e instanceof OAuthFailure?e.code:'CALLBACK_FAILED',502,e instanceof OAuthFailure?e.extra:null)}
 const sid=random();
 try{await saveSession(env,sid,tokens)}catch{return oauthError('SESSION_STORE_FAILED',503)}
 const resp=redirect('https://tradingwise.vercel.app/?ctrader=connected');
 resp.headers.append('set-cookie',cookie(COOKIE,sid,Math.floor(SESSION_MS/1000)));
 resp.headers.append('set-cookie',cookie(STATE_COOKIE,'',0));return resp;
}
// JSON-over-WebSocket transport; no write/trade message types exposed.
async function connectOpenApi(env,isLive=false){
 const host=isLive?'live.ctraderapi.com':'demo.ctraderapi.com';
 const response=await fetch(`https://${host}:5036/`,{headers:{upgrade:'websocket'}});
 if(response.status!==101||!response.webSocket)throw Error('cTrader gateway cannot open broker WebSocket');
 const ws=response.webSocket;ws.accept();let seq=0;const pending=new Map();
 const close=(why='cTrader socket closed')=>{for(const [,x] of pending){clearTimeout(x.timer);x.reject(Error(why))}pending.clear();try{ws.close(1000,'done')}catch{}};
 ws.addEventListener('message',event=>{
  let packet;try{packet=JSON.parse(typeof event.data==='string'?event.data:'')}catch{return}
  if(packet.payloadType===PROTO.ERROR){close('cTrader protocol error');return}
  const id=packet.clientMsgId;const item=pending.get(id);
  if(item&&packet.payloadType===item.expected){clearTimeout(item.timer);pending.delete(id);item.resolve(packet.payload||{})}
 });
 ws.addEventListener('close',()=>close('cTrader WebSocket closed'));
 const request=(type,payload,expected)=>new Promise((resolve,reject)=>{
  const id=`tw_${Date.now()}_${++seq}`;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('cTrader request timed out'))},11000);
  pending.set(id,{resolve,reject,expected,timer});
  try{ws.send(JSON.stringify({clientMsgId:id,payloadType:type,payload}))}catch(e){clearTimeout(timer);pending.delete(id);reject(Error('cTrader connection send failed'))}
 });
 try{await request(PROTO.APP_AUTH_REQ,{clientId:env.CTRADER_CLIENT_ID,clientSecret:env.CTRADER_CLIENT_SECRET},PROTO.APP_AUTH_RES)}catch(e){close('cTrader application authentication failed');throw e}
 return {request,close};
}
async function accounts(env,tokens){
 const conn=await connectOpenApi(env,false);
 try{const data=await conn.request(PROTO.ACCOUNT_LIST_REQ,{accessToken:tokens.accessToken},PROTO.ACCOUNT_LIST_RES);
  return (data.ctidTraderAccount||[]).map(a=>({accountId:String(a.ctidTraderAccountId),isLive:Boolean(a.isLive),brokerTitle:a.brokerTitle||'',traderLogin:String(a.traderLogin||'')})).filter(a=>/^\d+$/.test(a.accountId));
 }finally{conn.close()}
}
async function withAccount(env,tokens,accountId,handler){
 const list=await accounts(env,tokens),a=list.find(a=>a.accountId===String(accountId));if(!a)throw Error('Unauthorized cTrader account');
 const conn=await connectOpenApi(env,a.isLive);
 try{await conn.request(PROTO.ACCOUNT_AUTH_REQ,{ctidTraderAccountId:a.accountId,accessToken:tokens.accessToken},PROTO.ACCOUNT_AUTH_RES);return await handler(conn,a)}
 finally{conn.close()}
}
async function symbols(env,tokens,params){
 const accountId=params.get('account'),q=(params.get('q')||'').trim().toLowerCase().slice(0,90),offset=Math.max(0,Math.min(100000,Number(params.get('offset'))||0)),limit=Math.max(1,Math.min(100,Number(params.get('limit'))||70));
 if(!/^\d{1,20}$/.test(String(accountId)))return err('Choose an authorized cTrader account first',400);
 const raw=await withAccount(env,tokens,accountId,(conn)=>conn.request(PROTO.SYMBOLS_REQ,{ctidTraderAccountId:accountId,includeArchivedSymbols:false},PROTO.SYMBOLS_RES));
 const all=lightSymbols(raw,accountId),filtered=q?all.filter(s=>(s.symbol+' '+s.name).toLowerCase().includes(q)):all;
 return json({items:filtered.slice(offset,offset+limit),total:filtered.length,offset,limit,counts:{CTRADER:all.length},errors:{}});
}
async function candles(env,tokens,params){
 let parts;try{parts=parseCtraderId(params.get('symbol'))}catch{return err('Malformed cTrader symbol ID',400)}
 const tf=params.get('interval')||'1h',interval=TIMEFRAMES[tf];if(!interval)return err('Unsupported cTrader timeframe',400);
 const limit=Math.max(1,Math.min(500,Number(params.get('limit'))||300));
 const end=Date.now(),start=end-Math.min(90*86400000,Math.max(interval.seconds*1000*(limit+40),86400000));
 const raw=await withAccount(env,tokens,parts.accountId,async conn=>{
  const list=await conn.request(PROTO.SYMBOLS_REQ,{ctidTraderAccountId:parts.accountId,includeArchivedSymbols:false},PROTO.SYMBOLS_RES);
  if(!(list.symbol||[]).some(s=>String(s.symbolId)===parts.symbolId))throw Error('Symbol not found on this cTrader account');
  return conn.request(PROTO.TRENDBARS_REQ,{ctidTraderAccountId:parts.accountId,symbolId:parts.symbolId,period:interval.period,fromTimestamp:start,toTimestamp:end,count:limit},PROTO.TRENDBARS_RES)
 });
 const bars=normalizeTrendbars(raw.trendbar,tf).slice(-limit);
 if(!bars.length)return err('cTrader returned no historical candles',404);
 return json({id:ctraderId(parts.accountId,parts.symbolId),provider:'CTRADER',interval:tf,candles:bars,lastUpdate:bars.at(-1).time,aggregated:false});
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname,params=new URL(request.url).searchParams;
 if(path===PREFIX+'/health'){const checks=await readiness(env);return json({ok:true,configured:config(env)&&ready(checks),checks,scope:'accounts',mode:'oauth-read-only',requiresAccountConsent:true,synthetic:false});}
 if(!path.startsWith(PREFIX+'/'))return err('Not found',404);
 if(!config(env))return err('cTrader connector configuration incomplete',503);
 if(request.method==='GET'&&path===PREFIX+'/oauth/start')return ready(await readiness(env))?oauthStart(env):oauthError('CONFIG_NOT_READY',503);
 if(request.method==='GET'&&path===PREFIX+'/oauth/callback'){
  try{return await callback(request,env)}catch{return oauthError('CALLBACK_FAILED',502)}
 }
 if(request.method==='POST'&&path===PREFIX+'/logout'){
  const source=request.headers.get('origin');if(source&&new URL(source).origin!==new URL(env.CTRADER_REDIRECT_URI).origin)return err('Invalid origin',403);
  const sid=getCookies(request)[COOKIE];if(sid)await env.DB.prepare('DELETE FROM ctrader_sessions WHERE id_hash=?').bind(await hash(sid)).run();
  const res=json({disconnected:true});res.headers.append('set-cookie',cookie(COOKIE,'',0));return res;
 }
 if(request.method!=='GET')return err('Method not allowed',405);
 let session;try{session=await currentSession(request,env)}catch{return err('cTrader session expired or refresh failed; reconnect your account',401)}
 if(!session)return path===PREFIX+'/session'?json({connected:false,scope:'accounts'}):err('Connect your own cTrader account first',401);
 if(path===PREFIX+'/session')return json({connected:true,scope:'accounts'});
 try{
  if(path===PREFIX+'/accounts')return json({accounts:await accounts(env,session.tokens)});
  if(path===PREFIX+'/symbols')return await symbols(env,session.tokens,params);
  if(path===PREFIX+'/candles')return await candles(env,session.tokens,params);
  return err('Not found',404);
 }catch(e){return err(e.message==='Unauthorized cTrader account'?'Account not authorized':String(e.message||'cTrader provider is temporarily unavailable').slice(0,180),502)}
}};