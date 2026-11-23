import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

async function getPort(){return await new Promise((res,rej)=>{
  const s=net.createServer();s.on('error',rej);
  s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>res(port));});
});}

test('two real clients draft, run Hills against Full Court Press and observe both branches, violations, putbacks and fatigue',
  {timeout:65000}, async()=>{
  const port=await getPort();
  const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),COIN_MS:'40',SPIN_MS:'40',SIM_MS:'19',TICK_MS:'10'},stdio:['ignore','pipe','pipe']});
  const base=`http://127.0.0.1:${port}`;
  let stderr='';child.stderr.on('data',c=>stderr+=c.toString());
  const post=async(route,data)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
  const getState=async whom=>(await fetch(`${base}/api/state?code=${whom.code}&token=${whom.token}`)).json();
  const act=(whom,type,other={})=>post('/api/action',{code:whom.code,token:whom.token,type,...other});
  const until=async(fn,ms=16000)=>{const start=Date.now();while(Date.now()-start<ms){const result=await fn();if(result)return result;await delay(12);}throw Error('Timeout: '+stderr);};
  try{
    const health=await until(async()=>{try{const r=await fetch(base+'/health');if(!r.ok)return null;return r.json();}catch{return null;}},3000);
    assert.equal(health.version,'0.8.3');
    const first=await post('/api/create',{name:'Hills Team',format:1});
    const second=await post('/api/join',{code:first.code,name:'Press Team'});
    let state=await until(async()=>{const x=await getState(first);return x.phase==='auction'?x:null;});
    // Run the same real weighted wheel/draft as production without editing player data.
    for(let i=0;i<230;i++){
      state=await getState(first);
      if(state.phase==='lineup')break;
      if(['wheel','coinflip'].includes(state.phase)){await delay(28);continue;}
      if(state.phase==='placement'){
        const who=state.pending.winner===0?first:second;
        await act(who,'next');continue;
      }
      if(state.phase==='auction'){
        if(state.auction.mode==='free')await act(state.auction.turn===0?first:second,'select');
        else if(state.auction.mode==='normal'){
          const who=state.auction.turn===0?first:second;
          if(state.auction.highBidder===null)await act(who,'bid',{cents:100});
          else await act(who,'pass');
        }
      }
    }
    assert.equal(state.phase,'lineup','Draft never finished, state '+state.phase);
    await act(first,'scheme',{offense:'Run For The Hills',defense:'Full Court Press'});
    await act(second,'scheme',{offense:'Run For The Hills',defense:'Full Court Press'});
    state=await getState(first);
    assert.equal(state.teams[0].offense,'Run For The Hills');
    assert.equal(state.teams[1].defense,'Full Court Press');
    await act(first,'ready');await act(second,'ready');
    const seen={crash:false,kickout:false,backToPaint:false,violation:false,putback:false,press:false,nonPg:false,pass:false};
    let ids=new Set(),positiveStaminaDrain=false,shots=0;
    state=await until(async()=>{const x=await getState(first);return x.phase==='sim'?x:null;},2500);
    const baseline=state.teams.map(t=>({...t.energy}));
    state=await until(async()=>{
      const x=await getState(first);
      if(x.game?.event&&!ids.has(x.game.event.id)){
        const ev=x.game.event;ids.add(ev.id);
        if(ev.hillsMode==='paint-crash')seen.crash=true;
        if(ev.hillsMode==='kickout')seen.kickout=true;
        if(ev.hillsMode==='paint-after-kickout')seen.backToPaint=true;
        if(ev.displayEvent==='eight-second-violation')seen.violation=true;
        if(ev.putbackAttempt)seen.putback=true;
        if(ev.fullCourtPress)seen.press=true;
        if(ev.hillsInbounder && ev.hillsInbounder!==ev.shooter)seen.nonPg=true;
        if(ev.passerId)seen.pass=true;
        if(ev.type==='three'||ev.type==='mid'||ev.type==='dunk'||ev.type==='layup')shots++;
        assert.ok(ev.hillsMode);
        assert.ok(ev.fullCourtPress);
        assert.ok(ev.hillsInbounder);
        assert.notEqual(ev.hillsInbounder,ev.shooter);
        assert.equal(ev.hillsShooters.length,2);
        assert.equal(ev.hillsPaintPlayers.length,2);
        if(ev.displayEvent==='eight-second-violation')assert.equal(ev.points,0);
      }
      if(x.teams[0].roster.some(id=>x.teams[0].energy[id]<(baseline[0][id]??100)))positiveStaminaDrain=true;
      if(x.phase==='foulout'&&x.foulout){
        const side=x.foulout.side;
        const team=x.teams[side];
        const replacement=team.roster.find(id=>!x.game.active[side].includes(id)&&!x.game.fouledOut.includes(id));
        if(replacement)await act(side===0?first:second,'fouloutSub',{playerId:replacement});
      }
      return x.phase==='finished'?x:null;
    },17000);
    assert.ok(state.game.possessions>70);
    assert.ok(shots>20);
    assert.ok(positiveStaminaDrain);
    for(const k of ['crash','kickout','violation','press','nonPg','pass'])assert.equal(seen[k],true,k+' did not occur');
    assert.ok(seen.putback||seen.backToPaint,'expected extra crash or failed kickout in real match');
    assert.equal(state.teams[0].roster.length,8);
    assert.equal(state.teams[1].roster.length,8);
    assert.ok(state.game.score.reduce((a,b)=>a+b,0)>0);
  }finally{child.kill();}
});
