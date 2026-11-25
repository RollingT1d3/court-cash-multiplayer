import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

test('draft replacements move immediately to bench first, then vacant starters; assigned players still swap',{timeout:30000},async()=>{
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),COIN_MS:'35',SPIN_MS:'35',TICK_MS:'10'},stdio:['ignore','pipe','pipe']});
 const base='http://127.0.0.1:'+port;
 let err='';child.stderr.on('data',x=>err+=x);
 const req=async(route,data)=>{const r=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
 const act=(who,type,extra={})=>req('/api/action',{code:who.code,token:who.token,type,...extra});
 const state=async who=>(await fetch(base+'/api/state?code='+who.code+'&token='+who.token)).json();
 const until=async fn=>{const start=Date.now();while(Date.now()-start<5000){const x=await fn();if(x)return x;await delay(15);}throw Error('Timed out '+err);};
 try{
  await until(async()=>{try{return (await fetch(base+'/health')).ok;}catch{return false;}});
  const a=await req('/api/create',{name:'A',format:1}),b=await req('/api/join',{code:a.code,name:'B'}),clients=[a,b];
  const order=['Sixth','Bench 1','Bench 2','SG','SF','PF','C'];
  const placed=[0,0];
  for(let n=0;n<16;n++){
    let x=await until(async()=>{const s=await state(a);return s.phase==='auction'||s.phase==='placement'?s:null;});
    if(x.phase==='auction'){await act(clients[x.auction.turn],'pass');x=await state(a);}
    assert.equal(x.phase,'placement');
    const side=x.pending.winner,who=clients[side],id=x.pending.playerId,prior=x.teams[side].slots.PG;
    await act(who,'place',{playerId:id,slot:'PG'});
    x=await state(a);let slots=x.teams[side].slots;
    assert.equal(slots.PG,id);
    if(prior)assert.equal(slots[order[placed[side]-1]],prior,'displaced player must appear immediately');
    assert.equal(new Set(Object.values(slots).filter(Boolean)).size,placed[side]+1);
    assert.deepEqual(new Set(Object.values(slots).filter(Boolean)),new Set(x.teams[side].roster));
    if(placed[side]===1){
      await act(who,'place',{playerId:id,slot:'Sixth'});
      slots=(await state(a)).teams[side].slots;
      assert.equal(slots.PG,prior);assert.equal(slots.Sixth,id);
      await act(who,'place',{playerId:id,slot:'PG'});
      slots=(await state(a)).teams[side].slots;
      assert.equal(slots.PG,id);assert.equal(slots.Sixth,prior);
    }
    placed[side]++;
    await act(who,'next');
  }
  const done=await state(a);assert.equal(done.phase,'lineup');assert.deepEqual(placed,[8,8]);
 }finally{child.kill();}
});
