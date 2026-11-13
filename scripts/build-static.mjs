import {mkdir,cp,copyFile,rm} from 'node:fs/promises';
const out = new URL('../dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await copyFile(new URL('../index.html',import.meta.url), new URL('../dist/index.html',import.meta.url));
await cp(new URL('../src/',import.meta.url), new URL('../dist/src/',import.meta.url),{recursive:true});
console.log('Tradingwise static chart build ready: dist/index.html + dist/src');
