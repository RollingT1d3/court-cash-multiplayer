import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

test('explicit room departure closes empty lobbies, requires consent for forfeits, and revokes sessions', {timeout:20000}, async()=>{
  const port=await new Promise((resolve,reject)=>{
    const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
  });
  const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),COIN_MS:'30',SPIN_MS:'30',TICK_MS:'10'},stdio:'ignore'});
  const base='http://127.0.0.1:'+port;
  const post=async(route,data)=>{
    const r=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    const v=await r.json();if(!r.ok)throw Error(v.error);return v;
  };
  const get=async(who)=>{
    const r=await fetch(base+'/api/state?code='+who.code+'&token='+who.token);
    const v=await r.json();if(!r.ok)throw Error(v.error);return v;
  };
  const act=(who,type,extra={})=>post('/api/action',{code:who.code,token:who.token,type,...extra});
  try{
    let ready=false;
    for(let i=0;i<200;i++){try{ready=(await fetch(base+'/health')).ok;if(ready)break;}catch{}await delay(20);}
    assert.ok(ready);
    const lone=await post('/api/create',{name:'Solo',format:1});
    await assert.rejects(()=>act({...lone,token:'invalid'},'leave'),/Not authorized/);
    assert.equal((await get(lone)).phase,'lobby');
    await act(lone,'leave');
    await assert.rejects(()=>get(lone),/Room not found/);
    await assert.rejects(()=>post('/api/join',{code:lone.code,name:'Late guest'}),/does not exist/);
    for(const quitter of [0,1]){
      const a=await post('/api/create',{name:'Alpha',format:7});
      const b=await post('/api/join',{code:a.code,name:'Bravo'});
      const teams=[a,b],leaver=teams[quitter],winner=teams[1-quitter];
      // Even a host whose screen still shows a lobby must confirm after a join.
      await assert.rejects(()=>act(leaver,'leave'),/Confirm forfeiting/);
      assert.notEqual((await get(winner)).phase,'finished');
      await act(leaver,'leave',{confirmForfeit:true});
      const final=await get(winner);
      assert.equal(final.phase,'finished');
      assert.equal(final.result.winner,1-quitter);
      assert.equal(final.result.forfeit,true);
      assert.match(final.result.reason,/left the room and forfeited/);
      assert.equal(final.departed[quitter],true);
      await assert.rejects(()=>get(leaver),/Not authorized/);
      await assert.rejects(()=>act(winner,'rematch'),/opponent has left/);
      await act(winner,'leave');
      await assert.rejects(()=>get(winner),/Room not found/);
    }
  }finally{child.kill();}
});
test('Leave Room is available across room phases and final menu uses the same departure handler',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(html,/id="leave-room"/);
  assert.match(app,/\$\('leave-room'\)\.addEventListener\('click',leaveCurrentRoom\)/);
  assert.match(app,/\$\('final-main-menu'\)\?\.addEventListener\('click',leaveCurrentRoom\)/);
  assert.match(app,/sessionStorage\.removeItem\('court-cash-identity'\)/);
  assert.match(app,/window\.confirm\('Leave this room\?/);
});
