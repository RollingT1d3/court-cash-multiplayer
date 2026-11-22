import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const randomPort = async () => new Promise((res,rej)=>{
  const s=net.createServer();s.on('error',rej);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>res(port));});
});

test('two clients can join, coin-flip, draft, set schemes, time out and finish one game', {timeout:60000}, async () => {
  const port=await randomPort();
  const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),COIN_MS:'35',SPIN_MS:'35',SIM_MS:'10',TICK_MS:'10'},stdio:['ignore','pipe','pipe']});
  const base=`http://127.0.0.1:${port}`;
  let output=''; child.stderr.on('data',d=>output+=d);
  const req=async(route,body)=>{const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw Error(json.error);return json;};
  const state=async who=>{const res=await fetch(`${base}/api/state?code=${who.code}&token=${who.token}`);return res.json();};
  const action=(who,type,extra={})=>req('/api/action',{code:who.code,token:who.token,type,...extra});
  const until=async(predicate,timeout=12000)=>{const t=Date.now();while(Date.now()-t<timeout){const value=await predicate();if(value)return value;await delay(15);}throw Error('Timed out waiting for state. '+output);};
  try{
    await until(async()=>{try{const r=await fetch(base+'/health');return r.ok;}catch{return false;}},2500);
    const a=await req('/api/create',{name:'Alpha',format:1});
    const b=await req('/api/join',{code:a.code,name:'Bravo'});
    let s=await state(a);assert.equal(s.phase,'coinflip');assert.equal(s.teams.length,2);
    s=await until(async()=>{const x=await state(a);return x.phase==='auction'?x:null;});
    assert.equal(s.teams[s.coinWinner].name, s.teams[s.auction.opening].name);
    const initialChooser=s.auction.turn, winner=initialChooser===0?a:b,loser=initialChooser===0?b:a;
    await action(winner,'bid',{cents:5000});
    s=await state(a);assert.equal(s.auction.highBidder,initialChooser);assert.equal(s.auction.bid,5000);
    await action(loser,'pass');
    s=await state(a);assert.equal(s.phase,'placement');assert.equal(s.teams[initialChooser].budget,0);
    await action(winner,'place',{playerId:s.pending.playerId,slot:'PG'});
    await action(winner,'next');
    let rounds=0,seenFree=false;
    while(rounds++<150){
      s=await state(a);
      if(s.phase==='lineup')break;
      if(['wheel','coinflip'].includes(s.phase)){await delay(35);continue;}
      if(s.phase==='placement'){
        const who=s.pending.winner===0?a:b;
        await action(who,'next');continue;
      }
      if(s.phase==='auction'){
        if(s.auction.mode==='free'){
          seenFree=true;const who=s.auction.turn===0?a:b;await action(who,'select');
        }else if(s.auction.mode==='normal'){
          const who=s.auction.turn===0?a:b;
          if(s.auction.highBidder===null)await action(who,'bid',{cents:100});
          else await action(who,'pass');
        }
      }
    }
    assert.equal(s.phase,'lineup','Should finish drafting all sixteen players: '+JSON.stringify({phase:s.phase,spinIndex:s.spinIndex,rosters:s.teams.map(t=>t.roster.length),budget:s.teams.map(t=>t.budget),wheel:s.wheel,auction:s.auction,rounds}));
    assert.equal(seenFree,true);
    assert.deepEqual(s.teams.map(t=>t.roster.length),[8,8]);
    assert.equal(s.teams[initialChooser].budget,0);
    assert.equal(new Set(s.teams.flatMap(t=>t.roster)).size,16);
    assert.equal(s.remaining.length,16);
    await action(a,'scheme',{offense:'Run & Gun',defense:'Perimeter Secured'});
    await action(b,'scheme',{offense:'Old-School Buckets',defense:'Protect the Paint'});
    await action(a,'ready');await action(b,'ready');
    s=await until(async()=>{const x=await state(a);return x.phase==='sim'?x:null;});
    assert.equal(s.game.score.length,2);
    assert.equal(s.teams[0].timeouts,5);
    assert.equal(s.teams[1].timeouts,5);
    await action(a,'timeout');
    s=await state(a);assert.equal(s.phase,'timeout');assert.equal(s.teams[0].timeouts,4);
    await action(b,'scheme',{offense:'Pure Chaos',defense:'3-2 Zone'});
    s=await state(a);
    assert.equal(s.teams[1].offense,'Pure Chaos');
    assert.equal(s.teams[1].defense,'3-2 Zone');
    await assert.rejects(()=>action(b,'place',{playerId:s.teams[1].roster[0],slot:'PG'}),/Only the timeout caller/);
    const bench=s.teams[0].roster.find(x=>!s.game.active[0].includes(x));
    await action(a,'place',{playerId:bench,slot:'PG'});
    s=await state(a);assert.equal(s.game.active[0][0],bench);
    await action(a,'resume');
    s=await until(async()=>{const x=await state(a);return x.phase==='finished'?x:null;},15000);
    assert.equal(s.game.quarter>=4,true);
    assert.equal(s.teams[0].timeouts,4);
    assert.equal(s.teams[1].timeouts,5);
    assert.equal(s.result.forfeit,false);
    assert.equal(s.teams.reduce((n,t)=>n+t.wins,0),1);
    assert.equal(s.game.score.reduce((n,v)=>n+v,0)>0,true);
    assert.equal(s.game.possessions>100,true);
    assert.equal(typeof s.game.event.posterDunk,'boolean');
    assert.equal(typeof s.game.event.screen,'boolean');
    assert.equal(typeof s.game.event.deepThree,'boolean');
    assert.ok(s.game.event.shotDistanceFt>=3);
    assert.ok(s.game.event.shotClockRemaining>=1&&s.game.event.shotClockRemaining<=24);
    assert.equal(s.game.stats[s.teams[0].roster[0]].fga>=0,true);
  } finally {child.kill();}
});
