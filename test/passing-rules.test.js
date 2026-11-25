import test from 'node:test';
import assert from 'node:assert/strict';
import {PASS_DISTRIBUTIONS,passCount,passPath,resolvePassChain} from '../passing-rules.js';
import {possessionWindow} from '../transition-rules.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('every strategy varies pass counts, Team Ball moves it more than superstar, clock limits long chains',()=>{
 const means={};
 for(const [name,w] of Object.entries(PASS_DISTRIBUTIONS)){
  assert.equal(w.reduce((a,b)=>a+b,0),100);
  assert.ok(w[0]>0&&w[1]>0&&w[2]>0);
  const counts=Array.from({length:1000},(_,i)=>passCount(name,1,29,()=> (i+.5)/1000));
  assert.equal(counts.filter(x=>x===0).length,w[0]*10);
  assert.ok(new Set(counts).size>=4);
  means[name]=counts.reduce((a,b)=>a+b,0)/1000;
 }
 assert.ok(means['Team Ball']>means['Play Through Superstar']+1);
 assert.equal(passCount('Team Ball',1,5,()=>.999),0);
});
test('paths use real teammates without self-passes and preserve the intended final receiver',()=>{
 const ids=['pg','sg','sf','pf','c'];
 for(let n=0;n<=5;n++){
  const p=passPath(ids,'sf',n,'pg',null,()=>1,()=>.3);
  assert.equal(p.length,n+1);assert.equal(p.at(-1),'sf');
  if(n)assert.equal(p.at(-2),'pg');
  assert.ok(p.every((id,i)=>ids.includes(id)&&id!==p[i-1]));
 }
 assert.equal(passPath(ids,'sf',3,null,'c',()=>1,()=>.3)[0],'c');
});
test('only attempted passes exist, first turnover ends chain, times remain ordered',()=>{
 const path=['pg','sg','sf','c'];let calls=0;
 const resolved=resolvePassChain(path,()=>({durationMs:220,outcome:++calls===2?'intercepted':'complete'}));
 assert.equal(calls,2);assert.equal(resolved.attempts.length,2);
 assert.equal(resolved.attempts[1].fromId,'sg');
 assert.ok(resolved.attempts[1].startMs>resolved.attempts[0].endMs);
 assert.ok(resolved.durationMs>resolved.attempts.at(-1).endMs);
 assert.equal(resolvePassChain(['pg'],()=>{throw Error('no pass');}).durationMs,0);
 const full=resolvePassChain(path,()=>({durationMs:300,outcome:'complete'}));
 assert.equal(full.attempts.length,3);
 assert.ok(possessionWindow({transition:{durationMs:1850},passDurationMs:full.durationMs,foul:true,freeThrowResults:[true,true,true]},3250)>=1850+full.durationMs+2900);
});
test('client plays passes in order using rendered sender, receiver and interceptor locations',()=>{
 const browser={};runInNewContext(readFileSync(new URL('../public/court-motion.js',import.meta.url),'utf8'),{window:browser});
 const m=browser.CourtMotion,coords={pg:{x:.6,y:.4},sg:{x:.7,y:.2},sf:{x:.8,y:.6}};
 const resolved=resolvePassChain(['pg','sg','sf'],(a,b)=>({from:coords[a],to:coords[b],durationMs:200,outcome:b==='sf'?'intercepted':'complete',interceptorId:b==='sf'?'d':null,interceptionAt:{x:.75,y:.3}}));
 const e={passes:resolved.attempts,passDurationMs:resolved.durationMs};
 const positions=new Map([['pg',{x:600,y:200}],['sg',{x:700,y:100}],['sf',{x:800,y:300}],['d',{x:750,y:150}]]);
 const p1=m.passFrame(e,200);assert.equal(p1.pass.fromId,'pg');assert.equal(m.passBall(p1,positions,940,525,1).x,650);
 const p2=m.passFrame(e,e.passes[1].endMs);assert.equal(p2.pass.fromId,'sg');assert.equal(m.passBall(p2,positions,940,525,1).x,750);
 assert.equal(m.passFrame(e,e.passDurationMs),null);
});


test('v1.0 passing shot boost honors every exact bracket and only the final immediate catch',async()=>{
 const {passShotBonus,immediatePassShotBonus,boostedShotChance}=await import('../passing-rules.js');
 const expected=[0,.005,.01,.01,.01,.01,.01,.015,.02,.02,.025,.03,.035,.04,.04,.04,.04,.045,.045,.045,.05,.075,.10];
 for(let n=78;n<=100;n++)assert.equal(passShotBonus(n),expected[n-78],String(n));
 assert.equal(passShotBonus(0),0);
 const passes=[{fromId:'a',toId:'b',outcome:'complete'},{fromId:'b',toId:'c',outcome:'complete'}];
 const rating=(id,key)=>{assert.equal(key,'passing');return id==='a'?100:91;};
 const e={passes,shooter:'c',type:'three',rating};
 for(const type of ['mid','three','fade','layup','dunk'])assert.equal(immediatePassShotBonus({...e,type}),.04);
 assert.equal(immediatePassShotBonus({...e,passes:[]}),0);
 assert.equal(immediatePassShotBonus({...e,shooter:'b'}),0);
 assert.equal(immediatePassShotBonus({...e,ankleBreaker:true}),0);
 assert.equal(immediatePassShotBonus({...e,type:'fade',postFade:true}),0);
 assert.equal(immediatePassShotBonus({...e,fastBreak:{mode:'outlet'}}),0);
 assert.equal(immediatePassShotBonus({...e,fastBreak:{mode:'kickout'}}),.04);
 assert.equal(immediatePassShotBonus({...e,type:'putback'}),0);
 for(const outcome of ['intercepted','out-of-bounds'])assert.equal(immediatePassShotBonus({...e,passes:[passes[0],{...passes[1],outcome}]}),0);
 assert.ok(Math.abs(boostedShotChance(.40,.10)-.50)<1e-10);
 assert.ok(Math.abs(boostedShotChance(.83,.075)-.905)<1e-10);
 assert.equal(boostedShotChance(.95,.10),1);
 assert.equal(boostedShotChance(.4,0),.4);
});
