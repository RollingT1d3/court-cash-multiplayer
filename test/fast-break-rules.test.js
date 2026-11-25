import test from 'node:test';
import assert from 'node:assert/strict';
import {fastBreakPlan} from '../fast-break-rules.js';
const active=['a','b','c','d','e'],defenders=['f','g','h','i','j'];
const prev={offense:1,quarter:1,displayEvent:'interception',stealId:'a',interceptionAt:{x:.84,y:.5}};
const make=(stat,extra={})=>fastBreakPlan({previous:prev,offense:0,quarter:1,seconds:60,active,defenders,rating:stat,energy:()=>100,random:()=>.25,...extra});
test('only live steals in same period start a fast break, not made shots, timeouts or quarter changes',()=>{
 const stat=()=>80;
 assert.equal(make(stat,{timeout:true}),null);assert.equal(make(stat,{quarter:2}),null);
 assert.equal(make(stat,{seconds:2}),null);
 assert.equal(make(stat,{previous:{...prev,displayEvent:'miss'}}),null);
 assert.equal(make(stat,{previous:{...prev,stealId:'unknown'}}),null);
});
test('fast break recognizes defensive recovery and rewards a fast runner with a strong open shot',()=>{
 const fast=(id,k)=>defenders.includes(id)?(k==='speed'?45:60):k==='speed'||k==='dribbling'?99:k==='dunk'?98:k==='layup'?85:k==='three'?45:85;
 const plan=make(fast);
 assert.notEqual(plan.mode,'reset');
 assert.ok(active.includes(plan.shooter)&&defenders.includes(plan.defender));
 assert.equal(plan.type,'dunk');assert.ok(plan.seconds<=8);assert.ok(plan.gap>0);
 const slow=(id,k)=>defenders.includes(id)?99:k==='speed'||k==='dribbling'?35:70;
 assert.equal(make(slow).mode,'reset');
});
test('wide-open specialist can choose a three, outlet and kickout require actual distinct teammate',()=>{
 const stat=(id,k)=>defenders.includes(id)?45:k==='three'?99:k==='layup'||k==='dunk'?50:k==='mid'?60:99;
 const p=make(stat);
 assert.notEqual(p.mode,'reset');assert.equal(p.type,'three');
 if(p.mode!=='solo'){assert.notEqual(p.thief,p.shooter);assert.ok(p.from&&p.to);}
 assert.equal(p.origin.x,1-prev.interceptionAt.x);
});

test('varied speed, energy, reading and positioning can produce every break branch including drive-and-kick',()=>{
 let seed=91821;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const seen=new Set();
 for(let i=0;i<4000;i++){
  const attributes=['speed','dribbling','iq','teamwork','passing','layup','dunk','mid','three'];
  const stats=Object.fromEntries([...active,...defenders].map(id=>[id,Object.fromEntries(attributes.map(k=>[k,50+Math.floor(rnd()*51)]))]));
  const energy=Object.fromEntries([...active,...defenders].map(id=>[id,30+rnd()*70]));
  const previous={...prev,interceptionAt:{x:.42+rnd()*.49,y:.15+rnd()*.70}};
  const p=make((id,k)=>stats[id][k],{previous,energy:id=>energy[id],random:rnd});
  seen.add(p.mode);
  if(p.mode!=='reset'){
   assert.ok(p.gap>0&&p.seconds<=8);
   if(p.mode==='solo')assert.equal(p.shooter,p.thief);
   else{assert.notEqual(p.shooter,p.thief);assert.equal(Object.keys(p.passDefense).length,5);}
  }
 }
 assert.deepEqual([...seen].sort(),['kickout','outlet','reset','solo']);
});
