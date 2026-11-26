import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shotTendency,dunkAttemptChance,shotRangeWeights,chooseShotRange,maxVoluntaryThreeDistance,restrictThreeDistance,desperationThreeAllowed,fadeTendency} from '../shot-tendencies-v11.js';
import {fadeChance} from '../fade-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const sample={three:45,mid:75,layup:80,dunk:85};
const team={threeTarget:.29,paintTarget:.56,adherence:1,stats:sample};
test('tendencies interpolate approved anchors and exclude voluntary sub-50 shots',()=>{
 for(const [r,m] of [[0,0],[49,0],[50,.1],[60,1/3],[65,.45],[75,1],[80,1.325],[85,1.65],[90,2.075],[95,2.5],[100,3]])close(shotTendency(r),m);
 const w=shotRangeWeights(team);
 close(w.three,0);close(w.paint,.3976*1.65/(.3976*1.65+.3124));close(w.mid+w.paint,1);
 assert.equal(chooseShotRange(team,()=>0),'mid');
 assert.equal(chooseShotRange(team,()=>.999999),'paint');
});
test('required tactical shares survive weak ratings; specialized roles and low-skill fallback resolve',()=>{
 close(shotRangeWeights({...team,threeTarget:.68,paintTarget:.38,protectedRange:'three'}).three,.68);
 close(shotRangeWeights({...team,threeTarget:.11,paintTarget:.82,protectedRange:'paint'}).paint,.89*.82);
 close(shotRangeWeights({...team,threeTarget:.81,paintTarget:.13,protectedRange:'three'}).three,.81);
 close(shotRangeWeights({...team,threeTarget:.1,paintTarget:.13,protectedRange:'mid'}).mid,.9*.87);
 close(shotRangeWeights({...team,threeTarget:.98,paintTarget:.58,protectedRange:'three'}).three,.98);
 assert.equal(chooseShotRange({...team,stats:{three:10,mid:20,layup:30,dunk:40}},()=>.5),'paint');
 assert.equal(chooseShotRange({...team,protectedRange:'three',stats:{three:90,mid:10,layup:20,dunk:30}},()=>.9),'three');
});
test('dunk selection compares both skills; absolute elite bonus and clamps',()=>{
 for(const [d,l,p] of [[100,100,.58],[100,90,.70],[100,80,.82],[100,70,.94],[100,40,1],[95,85,.68],[90,90,.54],[90,70,.78],[85,80,.58],[80,80,.50],[80,90,.38],[70,90,.22],[60,85,.12],[45,95,0],[30,100,0],[100,50,.95]])close(dunkAttemptChance(d,l),p);
 assert.ok(dunkAttemptChance(40,30)>0);
});
test('distance gates are independent of strategy, rejected distance becomes normal three',()=>{
 for(const [r,max] of [[45,29],[79,29],[80,35],[84,35],[85,40],[89,40],[90,46],[94,46],[95,62],[100,62]])assert.equal(maxVoluntaryThreeDistance(r),max);
 assert.equal(restrictThreeDistance(55,45,{random:()=>.999}),29);
 assert.equal(restrictThreeDistance(30,79,{random:()=>0}),23);
 assert.equal(restrictThreeDistance(40,85),40);
 assert.equal(restrictThreeDistance(47,94,{random:()=>0}),23);
 assert.equal(restrictThreeDistance(62,95),62);
 const late={seconds:3,previous:{offense:1,quarter:2},offense:0,quarter:2};
 assert.equal(desperationThreeAllowed(late),true);
 for(const extra of [{seconds:4},{timeout:true},{offense:1},{quarter:3}])assert.equal(desperationThreeAllowed({...late,...extra}),false);
 assert.equal(restrictThreeDistance(62,45,{desperation:true}),62);
});
test('fade limits follow approved brackets and existing maximums',()=>{
 for(const [r,m] of [[20,0],[49,0],[50,.25],[59,.25],[60,.65],[69,.65],[70,1],[80,1.15],[90,1.3],[95,1.5],[100,1.5]])close(fadeTendency(r),m);
 assert.equal(fadeChance({type:'mid',fades:20,defense:100}),0);
 assert.ok(fadeChance({type:'mid',fades:100,defense:100,heightGap:12,iq:100,shotClockRemaining:1})<=.5);
 assert.ok(fadeChance({type:'layup',fades:100,defense:100,heightGap:12,iq:100,shotClockRemaining:1})<=.34);
});
test('all 250 profiles across strategic targets have finite, normalized selections',()=>{
 const players=['players.json','players-3.json'].flatMap(p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url),'utf8')));
 assert.equal(players.length,250);
 const plans=[[.32,.56,null],[.29,.56,null],[.68,.38,'three'],[.11,.82,'paint'],[.36,.60,null],[.81,.13,'three'],[.10,.13,'mid'],[.98,.58,'three'],[.08,.90,'paint'],[.08,.58,'paint']];
 for(const p of players)for(const [threeTarget,paintTarget,protectedRange] of plans)for(const adherence of [.15,.5,1]){
  const o={threeTarget,paintTarget,protectedRange,adherence,stats:p.stats};
  const w=shotRangeWeights(o);close(Object.values(w).reduce((a,b)=>a+b,0),1);
  assert.ok(Object.values(w).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert.ok(['three','mid','paint'].includes(chooseShotRange(o,()=>.999999)));
 }
 let seed=1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const counts={three:0,mid:0,paint:0};for(let i=0;i<20000;i++)counts[chooseShotRange(team,random)]++;
 const w=shotRangeWeights(team);assert.equal(counts.three,0);assert.ok(Math.abs(counts.paint/20000-w.paint)<.015);
});
test('live server uses new selection helpers; specialized point/hills and fast break routes retained',()=>{
 const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 for(const phrase of ['chooseShotRange({threeTarget,paintTarget,adherence,protectedRange','dunkAttemptChance(rating(shooter','restrictThreeDistance(threeDistanceFeet','point?pointAction.range:hills?','quickBreak?fastBreak.type'])assert.ok(s.includes(phrase));
});
