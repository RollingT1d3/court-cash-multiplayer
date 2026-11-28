import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
test('Advanced room drafts 18, trades two for one with Gatorade and plays with four reserves',{timeout:40000},async()=>{
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),COIN_MS:'25',SPIN_MS:'25',TICK_MS:'10',SIM_MS:'100'},stdio:['ignore','pipe','pipe']});
 let err='';child.stderr.on('data',d=>err+=d);const base='http://127.0.0.1:'+port;
 const req=async(route,data)=>{const r=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
 const act=(who,type,extra={})=>req('/api/action',{code:who.code,token:who.token,type,...extra});
 const state=async who=>(await fetch(base+'/api/state?code='+who.code+'&token='+who.token)).json();
 const until=async fn=>{const start=Date.now();while(Date.now()-start<7000){const x=await fn();if(x)return x;await delay(15);}throw Error('Timed out '+err);};
 try{
  await until(async()=>{try{return (await fetch(base+'/health')).ok;}catch{return false;}});
  const a=await req('/api/create',{name:'Advanced A',format:1,mode:'advanced'}),b=await req('/api/join',{code:a.code,name:'Advanced B'}),clients=[a,b];
  for(let n=0;n<18;n++){
   let x=await until(async()=>{const s=await state(a);return ['auction','placement'].includes(s.phase)?s:null;});
   assert.equal(x.mode,'advanced');
   if(x.phase==='auction'){
    if(x.auction.mode==='normal'&&x.auction.highBidder===1){await act(a,'bid',{cents:150});await act(b,'pass');}
    else if(x.auction.mode==='normal')await act(clients[x.auction.turn],'pass');
    else await act(clients[x.auction.turn],'select');
    x=await state(a);
   }
   assert.equal(x.phase,'placement');await act(clients[x.pending.winner],'next');
  }
  let x=await state(a);assert.equal(x.phase,'lineup');assert.equal(x.spinIndex,18);assert.deepEqual(x.teams.map(t=>t.roster.length),[10,8]);assert.deepEqual(x.teams.map(t=>t.gatorades),[2,2]);
  const offer={give:{players:x.teams[0].roster.slice(-2),gatorades:1},get:{players:x.teams[1].roster.slice(-1),gatorades:0}};
  await act(a,'tradeOffer',offer);x=await state(a);const id=x.trade.id;assert.equal(x.trade.expiresAt-x.trade.acceptAt,30000);
  await assert.rejects(()=>act(b,'tradeAnswer',{tradeId:id,accept:true}),/buffer/);
  await assert.rejects(()=>act(a,'ready'),/pending trade/);
  await delay(3050);await act(b,'tradeAnswer',{tradeId:id,accept:false});assert.equal((await state(a)).tradeUsed,false);
  await act(a,'tradeOffer',offer);x=await state(a);await delay(3050);await act(b,'tradeAnswer',{tradeId:x.trade.id,accept:true});
  x=await state(a);assert.deepEqual(x.teams.map(t=>t.roster.length),[9,9]);assert.deepEqual(x.teams.map(t=>t.gatorades),[1,3]);assert.equal(x.tradeUsed,true);
  await assert.rejects(()=>act(a,'tradeOffer',offer),/already been used/);
  await act(a,'ready');await act(b,'ready');x=await until(async()=>{const s=await state(a);return s.phase==='sim'?s:null;});
  assert.deepEqual(x.game.bench.map(t=>t.length),[4,4]);assert.ok(x.game.active.flat().every(Boolean));assert.equal(Object.keys(x.game.stats).length,18);
  x=await until(async()=>{const s=await state(a);if(s.phase!=='sim'||s.game.possessions<8)return false;try{await act(clients[s.game.offense],'timeout');return await state(a);}catch{return false;}});
  const side=x.timeout.caller,t=x.teams[side],pid=t.roster.filter(id=>!x.game.fouledOut.includes(id)).sort((a,b)=>t.energy[a]-t.energy[b])[0];
  if(t.energy[pid]<100){
   await assert.rejects(()=>act(clients[1-side],'gatorade',{playerId:pid,timeoutUntil:x.timeout.until}),/own current timeout/);
   await act(clients[side],'gatorade',{playerId:pid,timeoutUntil:x.timeout.until});const next=await state(a);assert.equal(next.teams[side].gatorades,t.gatorades-1);assert.equal(next.teams[side].energy[pid],Math.min(100,t.energy[pid]+3));
  }
  const reserve=x.game.bench[side].at(-1);await act(clients[side],'place',{playerId:reserve,slot:'PG'});assert.equal((await state(a)).game.active[side][0],reserve);
 }finally{child.kill();}
});
