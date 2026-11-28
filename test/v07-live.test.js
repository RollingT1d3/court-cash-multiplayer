import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as sleep} from 'node:timers/promises';

async function freePort(){return new Promise((resolve,reject)=>{
  const server=net.createServer();server.on('error',reject);
  server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
});}

test('real two-client game: defending timeout rejected, offense inbounds after pause, ankle break credited',
  {timeout:50000},async()=>{
    const port=await freePort();
    const child=spawn(process.execPath,['server.js'],{
      cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
      env:{...process.env,PORT:String(port),NODE_ENV:'test',CC_TEST_FORCE_ANKLE:'1',COIN_MS:'45',SPIN_MS:'45',SIM_MS:'95',TICK_MS:'10'}
    });
    let error='';child.stderr.on('data',d=>error+=d);
    const url=`http://127.0.0.1:${port}`;
    const req=async(path,data)=>{
      const res=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
      const j=await res.json();if(!res.ok)throw Error(j.error);return j;
    };
    const state=async person=>(await fetch(`${url}/api/state?code=${person.code}&token=${person.token}`)).json();
    const act=(person,type,payload={})=>req('/api/action',{code:person.code,token:person.token,type,...payload});
    const until=async(fn,ms=8000)=>{const start=Date.now();while(Date.now()-start<ms){const r=await fn();if(r)return r;await sleep(12);}throw Error('Timeout '+error);};
    try{
      const health=await until(async()=>{try{const r=await fetch(url+'/health');return r.ok?r.json():null;}catch{return null;}},2500);
      assert.equal(health.version,'1.2.0');
      const a=await req('/api/create',{name:'Home',format:1});
      const b=await req('/api/join',{code:a.code,name:'Away'});
      let s;
      for(let count=0;count<240;count++){
        s=await state(a);
        if(s.phase==='lineup')break;
        if(['coinflip','wheel'].includes(s.phase)){await sleep(35);continue;}
        if(s.phase==='placement')await act(s.pending.winner===0?a:b,'next');
        if(s.phase==='auction'){
          const turn=s.auction.turn===0?a:b;
          if(s.auction.mode==='free')await act(turn,'select');
          else if(s.auction.mode==='normal'){
            if(s.auction.highBidder===null)await act(turn,'bid',{cents:100});
            else await act(turn,'pass');
          }
        }
      }
      assert.equal(s.phase,'lineup');
      await act(a,'ready');await act(b,'ready');
      s=await until(async()=>{const x=await state(a);return x.phase==='sim'?x:null;});
      const owner=s.game.offense;
      const caller=owner===0?a:b,defending=owner===0?b:a;
      assert.equal(s.teams[1-owner].timeouts,6);
      await assert.rejects(()=>act(defending,'timeout'),/must have the ball/);
      let afterDenied=await state(a);
      assert.equal(afterDenied.phase,'sim');
      assert.equal(afterDenied.teams[1-owner].timeouts,6);
      await act(caller,'timeout');
      s=await state(a);
      assert.equal(s.phase,'timeout');
      assert.equal(s.timeout.possession,owner);
      assert.equal(s.game.offense,owner);
      assert.equal(s.teams[owner].timeouts,5);
      const oldPossessions=s.game.possessions;
      await sleep(190);
      s=await state(a);
      assert.equal(s.game.possessions,oldPossessions,'clock and possessions should freeze during timeout');
      await act(defending,'resume');
      s=await state(a);assert.equal(s.phase,'timeout');assert.equal(s.timeout.ready[1-owner],true);
      assert.equal(s.timeout.ready[owner],false);
      await act(caller,'resume');
      s=await state(a);
      assert.equal(s.game.offense,owner);
      assert.equal(s.game.timeoutInboundSide,owner);
      s=await until(async()=>{const x=await state(a);return x.game?.possessions>oldPossessions?x:null;},2000);
      assert.equal(s.game.event.inboundAfterTimeout,true);
      assert.equal(s.game.event.offense,owner);
      assert.equal(s.game.event.transition.kind,'inbound');
      assert.ok(s.game.event.transition.inbounderId&&s.game.event.transition.receiverId,'there must be a visible inbound pass after the timeout');
      const ids=new Set([s.game.event.id]);
      let ankle=s.game.event.ankleBreaker?s.game.event:null;
      await until(async()=>{
        if(ankle)return true;
        const x=await state(a);
        if(x.phase==='foulout'&&x.foulout){
          const side=x.foulout.side;
          const id=x.teams[side].roster.find(id=>!x.game.active[side].includes(id)&&!x.game.fouledOut.includes(id));
          if(id)await act(side===0?a:b,'fouloutSub',{playerId:id});
        }
        const ev=x.game?.event;
        if(ev&&!ids.has(ev.id)){
          ids.add(ev.id);
          if(ev.ankleBreaker)ankle=ev;
        }
        return Boolean(ankle);
      },4500);
      assert.ok(ankle,'test-only forced event should appear within a few possessions');
      assert.equal(ankle.ankleBreakerHandler,ankle.shooter);
      assert.equal(ankle.ankleBreakerDefender,ankle.defender);
      const after=await state(a);
      assert.ok(after.game.stats[ankle.shooter].ankleBreaks>=1);
      assert.equal(after.teams[owner].timeouts,5);
    }finally{child.kill();}
  });
