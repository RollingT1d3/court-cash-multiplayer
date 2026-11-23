import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { foulBonus,shootingFoulChance,shootFreeThrows,eligibleBench } from '../foul-rules.js';

test('shooting foul probabilities follow every requested FT bracket exactly',()=>{
  const cases=[
    [0,0],[79,0],[80,.01],[85,.01],[86,.02],[89,.02],
    [90,.03],[99,.03],[100,.05],
  ];
  for(const [ft,bonus] of cases){
    assert.equal(foulBonus(ft),bonus);
    for(const shot of ['three','mid'])assert.ok(Math.abs(shootingFoulChance(shot,ft)-(.02+bonus))<1e-12);
    for(const shot of ['layup','dunk'])assert.ok(Math.abs(shootingFoulChance(shot,ft)-(.05+bonus))<1e-12);
  }
  assert.throws(()=>shootingFoulChance('hook',80),/shot type/);
});
test('FT shooting is governed by FT skill and disqualified players stay off the bench',()=>{
  assert.deepEqual(shootFreeThrows(100,3,()=>.999999),{attempts:3,made:3});
  assert.deepEqual(shootFreeThrows(0,2,()=>0),{attempts:2,made:0});
  const dice=[.01,.60,.49];
  assert.deepEqual(shootFreeThrows(50,3,()=>dice.shift()),{attempts:3,made:2});
  assert.deepEqual(eligibleBench(['a','b','c','d'],['a','b'],['c']),['d']);
});

const freePort=async()=>new Promise((resolve,reject)=>{
  const server=net.createServer();server.on('error',reject);
  server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
});
test('six personal fouls pause the live game until a legal manual bench substitution', {timeout:60000},async()=>{
  const port=await freePort();
  const child=spawn(process.execPath,['server.js'],{
    cwd:process.cwd(),
    env:{...process.env,PORT:String(port),NODE_ENV:'test',CC_TEST_ALWAYS_FOUL:'1',COIN_MS:'35',SPIN_MS:'35',SIM_MS:'25',TICK_MS:'10'},
    stdio:['ignore','pipe','pipe']
  });
  let err='';child.stderr.on('data',d=>err+=d);
  const base=`http://127.0.0.1:${port}`;
  const post=async(route,v)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
  const get=async(who)=>{const r=await fetch(`${base}/api/state?code=${who.code}&token=${who.token}`);return r.json();};
  const action=(who,type,extra={})=>post('/api/action',{...who,type,...extra});
  const until=async(fn,ms=12000)=>{const start=Date.now();while(Date.now()-start<ms){const result=await fn();if(result)return result;await delay(15);}throw Error('Timed out. '+err);};
  try{
    await until(async()=>{try{return (await fetch(base+'/health')).ok;}catch{return false;}},3000);
    const a=await post('/api/create',{name:'Alpha',format:1});
    const b=await post('/api/join',{name:'Bravo',code:a.code});
    let s; let spins=0;
    while(spins++<230){
      s=await get(a);
      if(s.phase==='lineup')break;
      if(['coinflip','wheel'].includes(s.phase)){await delay(30);continue;}
      if(s.phase==='placement'){await action(s.pending.winner===0?a:b,'next');continue;}
      if(s.phase==='auction'){
        const who=s.auction.turn===0?a:b;
        if(s.auction.mode==='free')await action(who,'select');
        else if(s.auction.mode==='normal'){
          if(s.auction.highBidder===null)await action(who,'bid',{cents:100});
          else await action(who,'pass');
        }
      }
    }
    assert.equal(s.phase,'lineup','Draft should complete before foul-out test. '+err);
    await action(a,'ready');await action(b,'ready');
    const pause=await until(async()=>{const x=await get(a);return x.phase==='foulout'?x:null;},10000);
    const f=pause.foulout;assert.ok(f);
    assert.equal(pause.game.stats[f.playerId].pf,6);
    assert.ok(pause.game.fouledOut.includes(f.playerId));
    assert.equal(pause.game.active[f.side][f.slot],f.playerId);
    assert.equal(pause.teams[0].timeouts,5);
    assert.equal(pause.teams[1].timeouts,5);
    const frozen=pause.game.possessions;
    await delay(200);
    let paused=await get(a);
    assert.equal(paused.phase,'foulout');
    assert.equal(paused.game.possessions,frozen,'simulation should remain frozen');
    await assert.rejects(()=>action(f.side===0?b:a,'fouloutSub',{playerId:paused.game.active[f.side][0]}),/affected team/);
    await assert.rejects(()=>action(f.side===0?a:b,'fouloutSub',{playerId:f.playerId}),/eligible player/);
    const replacement=eligibleBench(paused.teams[f.side].roster,paused.game.active[f.side],paused.game.fouledOut)[0];
    assert.ok(replacement);
    await action(f.side===0?a:b,'fouloutSub',{playerId:replacement});
    const resumed=await get(a);
    assert.equal(resumed.phase,'sim');
    assert.equal(resumed.foulout,null);
    assert.equal(resumed.game.active[f.side][f.slot],replacement);
    assert.ok(!resumed.game.active[f.side].includes(f.playerId));
    assert.equal(resumed.teams[0].timeouts,5);
    assert.equal(resumed.teams[1].timeouts,5);
    // Immediately during simulation, a timeout must not allow the disqualified player to return.
    const caller=resumed.game.offense===0?a:b;
    await action(caller,'timeout');
    await assert.rejects(()=>action(caller,'place',{playerId:f.playerId,slot:'PG'}),/fouled out/);
  } finally {child.kill();}
});
