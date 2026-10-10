import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/atlas-push-sw.js',import.meta.url),'utf8');
test('device push displays amount and routes a tap to its receipt',async()=>{
 const handlers={};const shown=[];const visited=[];let work;
 const client={url:'https://justatlas.xyz/',postMessage(){},async navigate(url){visited.push(url)},async focus(){}};
 const self={location:{origin:'https://justatlas.xyz'},addEventListener:(event,fn)=>{handlers[event]=fn},
  skipWaiting(){},registration:{async showNotification(title,options){shown.push({title,options})}},
  clients:{async claim(){},async matchAll(){return[client]},async openWindow(url){visited.push(url)}}};
 vm.runInNewContext(source,{self,URL});
 const payload={id:'a'.repeat(32),title:'You received ₦500.00',body:'₦500.00 arrived from @ade.',url:'/transaction/receipt#private'};
 handlers.push({data:{json:()=>payload},waitUntil(p){work=p}});await work;
 assert.equal(shown[0].title,payload.title);assert.equal(shown[0].options.body,payload.body);
 handlers.notificationclick({notification:{data:shown[0].options.data,close(){}},waitUntil(p){work=p}});await work;
 assert.equal(visited[0],'https://justatlas.xyz/transaction/receipt');
 payload.url='//evil.example';handlers.push({data:{json:()=>payload},waitUntil(p){work=p}});await work;
 assert.equal(shown[1].options.data.url,'/notifications');
});
