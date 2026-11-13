import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

const empty=()=>({version:1,rules:[],events:[],outbox:[]});
export class AlertStore{
 constructor(path=resolve('data/alerts.json')){this.path=path;this.data=empty();this.pending=Promise.resolve();this.initialized=false}
 async load(){
  if(this.initialized)return this.snapshot();
  let raw;try{raw=await readFile(this.path,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
  if(raw){const parsed=JSON.parse(raw);if(parsed?.version!==1||!Array.isArray(parsed.rules)||!Array.isArray(parsed.events)||!Array.isArray(parsed.outbox))throw Error('Invalid alert store; refusing to overwrite');this.data=parsed}
  this.initialized=true;return this.snapshot();
 }
 snapshot(){return structuredClone(this.data)}
 async mutate(fn){
  const task=this.pending.then(async()=>{
   if(!this.initialized)throw Error('AlertStore must load first');
   const next=this.snapshot();const result=await fn(next);
   await mkdir(dirname(this.path),{recursive:true});const tmp=`${this.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
   await writeFile(tmp,JSON.stringify(next,null,2),{mode:0o600});await rename(tmp,this.path);this.data=next;return result;
  });this.pending=task.catch(()=>{});return task;
 }
}
