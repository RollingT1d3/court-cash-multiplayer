import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {illegalScreenChance,passingOutChance,interceptionChance,onBallStealBase,
  handleStealReduction,onBallStealChance,screenStrengthBonus,passFlightMs,
  laneProximity,passingLaneDefenders,OFFENSE_ANCHORS} from '../court-rules-v05.js';

test('illegal screens: every IQ boundary, including 60, 70, 79, 89, 90',()=>{
  const cases=[[0,.20],[60,.20],[61,.15],[70,.15],[71,.09],[79,.09],[80,.05],[89,.05],[90,.01],[99,.01],[100,.01]];
  for(const [rating,expected] of cases)assert.equal(illegalScreenChance(rating),expected,`IQ ${rating}`);
});
test('passes out of bounds: exact % bracket cutoffs, including isolated 80',()=>{
  const cases=[[0,.10],[65,.10],[66,.08],[70,.08],[71,.05],[79,.05],[80,.01],[81,0],[89,0],[90,0],[100,0]];
  for(const [passing,expected] of cases)assert.equal(passingOutChance(passing),expected,`pass ${passing}`);
});
test('pass interception: exact steal ratings, only in lane, 90+ pass immunity',()=>{
  const cases=[[0,0],[79,0],[80,.02],[81,.04],[85,.04],[86,.05],[89,.05],[90,.06],[92,.06],[93,.07],[98,.07],[99,.08],[100,.10]];
  for(const [steal,expected] of cases){
    assert.equal(interceptionChance(steal,89,true),expected,`steal ${steal}`);
    assert.equal(interceptionChance(steal,89,false),0,`steal ${steal} outside lane`);
    assert.equal(interceptionChance(steal,90,true),0,`90+ passer immunity`);
    assert.equal(interceptionChance(steal,100,true),0,`100 passer immunity`);
  }
});
test('on-ball steals: exact base brackets',()=>{
  const cases=[[0,0],[69,0],[70,.01],[71,.015],[75,.015],[76,.02],[79,.02],[80,.03],[84,.03],[85,.035],[87,.035],[88,.04],[89,.04],[90,.045],[94,.045],[95,.05],[98,.05],[99,.055],[100,.07]];
  for(const [steal,expected] of cases)assert.equal(onBallStealBase(steal),expected,`steal ${steal}`);
});
test('handles subtract percentage POINTS, with floor zero (not negative)',()=>{
  const cases=[[0,0],[79,0],[80,.01],[81,.015],[84,.015],[85,.02],[89,.02],[90,.025],[94,.025],[95,.03],[98,.03],[99,.035],[100,.04]];
  for(const [handle,expected] of cases)assert.equal(handleStealReduction(handle),expected,`dribbling ${handle}`);
  assert.equal(onBallStealChance(100,100),.03);
  assert.equal(onBallStealChance(80,99),0);
  assert.equal(onBallStealChance(70,100),0);
  assert.equal(onBallStealChance(99,80),.045);
});
test('stronger players set better legal screens; higher passing shortens ball flight',()=>{
  assert.equal(screenStrengthBonus(50),0);
  assert.equal(screenStrengthBonus(100),.04);
  for(let stat=0;stat<100;stat++){
    assert.ok(screenStrengthBonus(stat+1)>=screenStrengthBonus(stat));
    assert.ok(passFlightMs(stat+1)<passFlightMs(stat));
  }
});
test('pass-lane interception only for a defender geometrically between passer and receiver',()=>{
  const from={x:.65,y:.5},to={x:.88,y:.5};
  assert.ok(laneProximity(from,to,{x:.73,y:.5}));
  assert.equal(laneProximity(from,to,{x:.73,y:.9}),null);
  assert.equal(laneProximity(from,to,{x:.35,y:.5}),null);
  assert.equal(laneProximity(from,from,{x:.73,y:.5}),null);
  const defenders=['a','b','c','d','e'];
  const list=passingLaneDefenders(from,to,defenders,false);
  assert.ok(list.some(x=>x.id==='a'));
  assert.ok(!list.some(x=>x.id==='b'));
  assert.ok(!list.some(x=>x.id==='c'));
  const zone=passingLaneDefenders(from,to,defenders,true);
  assert.ok(zone.some(x=>x.id==='b'));
  assert.equal(OFFENSE_ANCHORS.length,5);
});
test('v0.5 gameplay uses passing lane, distinct turnover outcomes and client flight animation',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(server,/passingLaneDefenders\(/);
  assert.match(server,/interceptionChance\(/);
  assert.match(server,/onBallStealChance\(/);
  assert.match(server,/illegalScreenChance\(/);
  assert.match(server,/passFlightMs\(/);
  assert.match(server,/pass-out-of-bounds/);
  assert.match(server,/interception/);
  assert.match(app,/event\.passerId/);
  assert.match(app,/event\.passDurationMs/);
});
