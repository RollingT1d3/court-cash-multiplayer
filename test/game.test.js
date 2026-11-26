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
  const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),COIN_MS:'35',SPIN_MS:'35',SIM_MS:'50',TICK_MS:'10'},stdio:['ignore','pipe','pipe']});
  const base=`http://127.0.0.1:${port}`;
  let output=''; child.stderr.on('data',d=>output+=d);
  const req=async(route,body)=>{const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw Error(json.error);return json;};
  const state=async who=>{const res=await fetch(`${base}/api/state?code=${who.code}&token=${who.token}`);return res.json();};
  const action=(who,type,extra={})=>req('/api/action',{code:who.code,token:who.token,type,...extra});
  const until=async(predicate,timeout=12000)=>{const t=Date.now();while(Date.now()-t<timeout){const value=await predicate();if(value)return value;await delay(15);}throw Error('Timed out waiting for state. '+output);};
  try{
    await until(async()=>{try{const r=await fetch(base+'/health');return r.ok;}catch{return false;}},2500);
    const a=await req('/api/create',{name:'Alpha',format:1,color:'purple'});
    await assert.rejects(()=>req('/api/join',{code:a.code,name:'Bravo',color:'purple'}),/already taken/);
    const b=await req('/api/join',{code:a.code,name:'Bravo',color:'grass'});
    let s=await state(a);assert.equal(s.phase,'coinflip');assert.equal(s.teams.length,2);
    assert.deepEqual(s.teams.map(t=>t.color),['purple','grass']);
    assert.deepEqual((await state(b)).teams.map(t=>t.color),['purple','grass']);
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
    assert.equal(s.remaining.length,s.players.filter(p=>p.weight>0).length-16);
    assert.deepEqual(new Set(s.remaining),new Set(s.players.map(p=>p.id).filter(id=>!s.teams.some(t=>t.roster.includes(id)))));
    await action(a,'scheme',{offense:'Run & Gun',defense:'Perimeter Secured'});
    await action(b,'scheme',{offense:'Old-School Buckets',defense:'Protect the Paint'});
    await action(a,'ready');await action(b,'ready');
    s=await until(async()=>{const x=await state(a);return x.phase==='sim'?x:null;});
    assert.equal(s.game.score.length,2);
    assert.equal(s.game.quarter,1);
    assert.equal(s.game.periodLength,600);
    assert.ok(s.game.secondsLeft>0 && s.game.secondsLeft<=600);
    // One server-authoritative 25%-per-style selection, shared by both clients.
    assert.ok(['midnight-stars','dark-brown','blue-sky','whiteout'].includes(s.game.courtStyle));
    const otherScreen=await state(b);
    assert.equal(otherScreen.game.courtStyle,s.game.courtStyle);
    // Every new game jumps the two *starting centers*, not a coin flip.
    const tip=s.game.tipoff;
    assert.deepEqual(tip.centerIds,s.game.active.map(five=>five[4]));
    assert.deepEqual(tip.centerHeights,tip.centerIds.map(id=>s.players.find(p=>p.id===id).heightInches));
    assert.ok([0,1].includes(tip.winningTeam));
    assert.ok(Math.abs(tip.probabilities.reduce((a,b)=>a+b,0)-1)<1e-12);
    assert.equal(Math.abs(tip.centerHeights[0]-tip.centerHeights[1]),tip.heightDifference);
    assert.equal(s.teams[0].timeouts,6);
    assert.equal(s.teams[1].timeouts,6);
    // Only the team currently possessing the ball may call timeout.
    let callerIdx,caller,opponent;
    await until(async()=>{
      const x=await state(a);
      if(x.phase!=='sim')return false;
      callerIdx=x.game.offense;caller=callerIdx===0?a:b;opponent=callerIdx===0?b:a;
      try{await action(caller,'timeout');return true;}
      catch(e){if(/must have the ball/.test(String(e)))return false;throw e;}
    },1800);
    s=await state(a);assert.equal(s.phase,'timeout');
    assert.ok(s.timeout.until-s.serverTime>44000 && s.timeout.until-s.serverTime<=45000);
    assert.equal(s.teams[callerIdx].timeouts,5);
    assert.equal(s.timeout.possession,callerIdx);
    await action(opponent,'scheme',{offense:'Pure Chaos',defense:'3-2 Zone'});
    s=await state(a);
    assert.equal(s.teams[1-callerIdx].offense,'Pure Chaos');
    assert.equal(s.teams[1-callerIdx].defense,'3-2 Zone');
    await assert.rejects(()=>action(opponent,'place',{playerId:s.teams[1-callerIdx].roster[0],slot:'PG'}),/Only the timeout caller/);
    const bench=s.teams[callerIdx].roster.find(x=>!s.game.active[callerIdx].includes(x));
    await action(caller,'place',{playerId:bench,slot:'PG'});
    s=await state(a);assert.equal(s.game.active[callerIdx][0],bench);
    const frozenPossessions=s.game.possessions;
    await action(caller,'resume');
    s=await state(a);
    assert.equal(s.game.offense,callerIdx);
    assert.equal(s.game.timeoutInboundSide,callerIdx);
    const inbound=await until(async()=>{
      const x=await state(a);
      return x.game?.possessions>frozenPossessions?x:null;
    },2000);
    assert.equal(inbound.game.event.inboundAfterTimeout,true);
    assert.equal(inbound.game.event.offense,callerIdx);
    s=await until(async()=>{
      const x=await state(a);
      // A fast simulation can trigger a legitimate six-foul pause. Complete
      // its mandatory bench substitution rather than leaving the test frozen.
      if(x.phase==='foulout'&&x.foulout){
        const side=x.foulout.side,team=x.teams[side];
        const bench=team.roster.find(id=>!x.game.active[side].includes(id)&&!x.game.fouledOut.includes(id));
        if(bench)await action(side===0?a:b,'fouloutSub',{playerId:bench});
      }
      return x.phase==='finished'?x:null;
    },15000);
    assert.equal(s.game.quarter>=4,true);
    const overtimePeriods=Math.max(0,s.game.quarter-4);
    assert.equal(s.teams[callerIdx].timeouts,5+overtimePeriods);
    assert.equal(s.teams[1-callerIdx].timeouts,6+overtimePeriods);
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
