// Minimal WebSocket transport for same-origin dashboard sessions.
// Upstream provider traffic uses standards-compliant Node 22 WebSocket client.
import {createHash} from 'node:crypto';

function frame(payload,opcode=1){
 const bytes=Buffer.isBuffer(payload)?payload:Buffer.from(String(payload));const length=bytes.length;let header;
 if(length<126){header=Buffer.alloc(2);header[1]=length}
 else if(length<65536){header=Buffer.alloc(4);header[1]=126;header.writeUInt16BE(length,2)}
 else{header=Buffer.alloc(10);header[1]=127;header.writeBigUInt64BE(BigInt(length),2)}
 header[0]=0x80|opcode;return Buffer.concat([header,bytes]);
}
export function websocketUpgrade(req,socket,head,onConnected){
 const origin=req.headers.origin;
 if(origin){let host;try{host=new URL(origin).host}catch{socket.destroy();return}if(host!==req.headers.host){socket.destroy();return}}
 const key=req.headers['sec-websocket-key'];
 if(req.headers.upgrade?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13'||typeof key!=='string'||Buffer.from(key,'base64').length!==16){socket.destroy();return}
 const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 let leftover=Buffer.alloc(0),closed=false;
 const session={
  send(packet){if(closed||socket.destroyed||socket.writableLength>1048576)return;socket.write(frame(JSON.stringify(packet)))},
  close(){if(closed)return;closed=true;try{socket.write(frame(Buffer.alloc(0),8))}catch{}socket.end();session.onClose?.()},
  onMessage:null,onClose:null
 };
 socket.on('data',chunk=>{
  if(closed)return;leftover=Buffer.concat([leftover,chunk]);if(leftover.length>65536){session.close();return}
  while(leftover.length>=2){
   const first=leftover[0],second=leftover[1],op=first&0x0f;
   if(!(first&0x80)||!(second&0x80)){session.close();return} // no fragmentation, client must mask
   const lengthCode=second&0x7f;let length=lengthCode,offset=2;
   if(lengthCode===126){if(leftover.length<4)return;length=leftover.readUInt16BE(2);offset=4}
   if(lengthCode===127){if(leftover.length<10)return;const size=leftover.readBigUInt64BE(2);if(size>32768n){session.close();return}length=Number(size);offset=10}
   if(length>32768){session.close();return}if(leftover.length<offset+4+length)return;
   const mask=leftover.subarray(offset,offset+4);const data=Buffer.from(leftover.subarray(offset+4,offset+4+length));for(let i=0;i<data.length;i++)data[i]^=mask[i%4];
   leftover=leftover.subarray(offset+4+length);
   if(op===8){session.close();return}
   if(op===9){socket.write(frame(data,10));continue}
   if(op!==1){session.close();return}
   try{session.onMessage?.(JSON.parse(data.toString('utf8')))}catch{session.send({type:'error',message:'Invalid WebSocket JSON'})}
  }
 });
 socket.on('close',()=>{if(!closed){closed=true;session.onClose?.()}});
 socket.on('error',()=>{if(!closed){closed=true;session.onClose?.()}});
 onConnected(session);
 if(head?.length)socket.emit('data',head);
}
