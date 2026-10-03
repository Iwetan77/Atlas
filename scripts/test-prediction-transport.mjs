import test from 'node:test';
import assert from 'node:assert/strict';
import {runDeviceRequests,checkDeviceRequest} from '../src/signing/prediction-transport.ts';
const req=(id,method='GET',url='https://clob.polymarket.com/auth/derive-api-key')=>({
 id,method,url,headers:{Accept:'application/json'},...(method==='POST'?{body:'{}'}:{})
});
const envelope=requests=>({expiresAtUnixMs:Date.now()+60000,requests});
test('auth derives first, creates only on 400/404, then deploys with exactly the supplied bytes',async()=>{
 const requests=[req('auth'),{...req('authCreate','POST','https://clob.polymarket.com/auth/api-key'),onFailure:{id:'auth',statuses:[400,404]}},
  {...req('relay','POST','https://relayer-v2.polymarket.com/submit'),body:'{"nonce":"7"}'}];
 for(const first of [200,404,403]){
  const calls=[];
  const results=await runDeviceRequests(envelope(requests),async(url,options)=>{
   calls.push([url,options]);return new Response(JSON.stringify({ok:true}),{status:calls.length===1?first:200});
  });
  assert.deepEqual(results.map(r=>r.id),first===200?['auth','relay']:first===404?['auth','authCreate','relay']:['auth']);
  if(first!==403){assert.equal(calls.at(-1)[1].body,'{"nonce":"7"}');assert.equal(calls.at(-1)[1].redirect,'error');}
 }
});
test('lost order response is reported once, never retried',async()=>{
 let posts=0;
 const results=await runDeviceRequests(envelope([req('order','POST','https://clob.polymarket.com/order')]),async()=>{
  posts++;throw new Error('reply lost');
 });
 assert.equal(posts,1);assert.deepEqual(results,[{id:'order',status:0,body:null}]);
});
test('unknown hosts, redirects, spoofed client locations and changed methods are refused before any send',async()=>{
 for(const request of [
  req('bad','POST','https://attacker.example/order'),
  {...req('bad'),headers:{'X-Forwarded-For':'somewhere'}},
  req('bad','POST','https://clob.polymarket.com/auth/derive-api-key'),
  req('bad','POST','https://clob.polymarket.com@attacker.example/order'),
  req('bad','POST','https://relayer-v2.polymarket.com/anything'),
 ]){
  assert.throws(()=>checkDeviceRequest(request),/not supported/);
  let called=false;await assert.rejects(runDeviceRequests(envelope([request]),async()=>{called=true;}),/not supported/);
  assert.equal(called,false);
 }
});
test('expired envelope cannot submit an order; failed allowance cannot continue',async()=>{
 let calls=0;
 assert.deepEqual(await runDeviceRequests({expiresAtUnixMs:1,requests:[req('order','POST','https://clob.polymarket.com/order')]},async()=>{calls++;}),[]);
 assert.equal(calls,0);
 const results=await runDeviceRequests(envelope([
  req('allowance','GET','https://clob.polymarket.com/balance-allowance/update?asset_type=COLLATERAL&signature_type=3'),
  req('order','POST','https://clob.polymarket.com/order'),
 ]),async()=>{calls++;return new Response('{}',{status:401});});
 assert.equal(calls,1);assert.equal(results.length,1);assert.equal(results[0].status,401);
});
