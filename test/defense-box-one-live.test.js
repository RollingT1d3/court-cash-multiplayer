import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const freePort=()=>new Promise((resolve,reject)=>{
 const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});
});
test('Box-and-One is selectable and resolves a full game with a dedicated defender',
  {timeout:60000},async()=>{
 const port=await freePort();
 const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),COIN_MS:'35',SPIN_MS:'35',SIM_MS:'28',TICK_MS:'10'},stdio:['ignore','pipe','pipe']});
 let err='';child.stderr.on('data',x=>err+=x);
 const root=`http://127.0.0.1:${port}`;
 const req=async(route,data)=>{const res=await fetch(root+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const body=await res.json();if(!res.ok)throw Error(body.error||res.status);return body;};
 const act=(who,type,extra={})=>req('/api/action',{code:who.code,token:who.token,type,...extra});
 const state=async(who)=>(await fetch(`${root}/api/state?code=${who.code}&token=${who.token}`)).json();
 const until=async(fn,ms=11000)=>{const start=Date.now();while(Date.now()-start<ms){const val=await fn();if(val)return val;await delay(11);}throw Error('Timed out. '+err);};
 try{
  const health=await until(async()=>{try{const r=await fetch(root+'/health');return r.ok?await r.json():null;}catch{return null;}},2500);
  assert.equal(health.version,'0.9.1');
  const a=await req('/api/create',{name:'Golden Guards',format:1});
  const b=await req('/api/join',{code:a.code,name:'Block City'});
  let snapshot;
  for(let attempts=0;attempts<300;attempts++){
    snapshot=await state(a);
    if(snapshot.phase==='lineup')break;
    if(['coinflip','wheel'].includes(snapshot.phase)){await delay(25);continue;}
    if(snapshot.phase==='placement'){await act(snapshot.pending.winner===0?a:b,'next');continue;}
    if(snapshot.phase==='auction'){
      const turn=snapshot.auction.turn===0?a:b;
      if(snapshot.auction.mode==='free')await act(turn,'select');
      else if(snapshot.auction.mode==='normal'){
        if(snapshot.auction.highBidder===null)await act(turn,'bid',{cents:100});
        else await act(turn,'pass');
      }
    }
  }
  assert.equal(snapshot.phase,'lineup');
  const originalRosters=snapshot.teams.map(t=>[...t.roster]);
  await act(a,'scheme',{offense:'Play Through Point',defense:'Box-and-One'});
  await act(b,'scheme',{offense:'Play Through Point',defense:'2-2-1 Zone'});
  snapshot=await state(a);
  assert.equal(snapshot.teams[0].offense,'Play Through Point');
  assert.equal(snapshot.teams[1].defense,'2-2-1 Zone');
  await act(a,'ready');await act(b,'ready');
  snapshot=await until(async()=>{const x=await state(a);return x.phase==='sim'?x:null;},2500);
  const encountered=new Set(),pointActions=new Set(),seenZones=new Set();
  snapshot=await until(async()=>{
    const x=await state(a),ev=x.game?.event;
    if(ev&&!encountered.has(ev.id)){
      encountered.add(ev.id);
      const defense=x.teams[1-ev.offense].defense;
      assert.ok(['Box-and-One','2-2-1 Zone'].includes(defense));
      assert.equal(ev.zoneDefense,defense);
      assert.ok(ev.zonePositions);
      assert.equal(Object.keys(ev.zonePositions).length,5);
      seenZones.add(ev.zoneDefense);
      if(defense==='Box-and-One'){
        assert.ok(ev.boxTarget&&ev.boxChaser);
        assert.equal(new Set([ev.boxChaser,...ev.boxHigh,...ev.boxLow]).size,5);
        assert.equal(ev.boxHigh.length,2);assert.equal(ev.boxLow.length,2);
        if(ev.shooter===ev.boxTarget)assert.equal(ev.defender,ev.boxChaser);
        else assert.notEqual(ev.defender,ev.boxChaser);
      }
      assert.ok(ev.pointMode);
      assert.equal(ev.pointCorners.length,2);
      assert.ok(ev.pointPG);
      assert.ok(ev.pointCenter);
      pointActions.add(ev.pointMode);
      if(ev.passerId&&x.players.find(p=>p.id===ev.passerId)?.stats.passing>=90){
         assert.notEqual(ev.displayEvent,'interception');
      }
    }
    if(x.phase==='foulout'&&x.foulout){
      const idx=x.foulout.side;
      const replacement=x.teams[idx].roster.find(id=>!x.game.active[idx].includes(id)&&!x.game.fouledOut.includes(id));
      if(replacement)await act(idx===0?a:b,'fouloutSub',{playerId:replacement});
    }
    return x.phase==='finished'?x:null;
  },17000);
  assert.ok(snapshot.game.possessions>75);
  assert.ok(encountered.size>45);
  assert.ok(pointActions.size>=3,`expected distinct point plays, got ${[...pointActions].join(',')}`);
  assert.deepEqual([...seenZones].sort(),['2-2-1 Zone','Box-and-One']);

  assert.ok(snapshot.game.possessions>75);
 }finally{child.kill();}
});
