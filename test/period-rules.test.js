import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePeriod, regulationQuarterSeconds } from '../period-rules.js';

test('every overtime awards one timeout per team, preserving unused timeouts',()=>{
  const teams=[{timeouts:0},{timeouts:2}];
  const game={quarter:4,period:'Q4',secondsLeft:0,score:[100,100]};
  assert.equal(advancePeriod(game,teams),'overtime');
  assert.equal(game.period,'OT1');
  assert.equal(game.secondsLeft,180);
  assert.equal(game.periodLength,180);
  assert.deepEqual(teams.map(t=>t.timeouts),[1,3]);
  assert.equal(advancePeriod(game,teams),'playing');
  assert.deepEqual(teams.map(t=>t.timeouts),[1,3]);
  teams[0].timeouts--;
  game.secondsLeft=0;game.score=[110,110];
  assert.equal(advancePeriod(game,teams),'overtime');
  assert.equal(game.period,'OT2');
  assert.equal(game.secondsLeft,180);
  assert.equal(game.periodLength,180);
  assert.deepEqual(teams.map(t=>t.timeouts),[1,4]);
  game.secondsLeft=0;game.score=[120,120];
  assert.equal(advancePeriod(game,teams),'overtime');
  assert.equal(game.period,'OT3');
  assert.deepEqual(teams.map(t=>t.timeouts),[2,5]);
  game.secondsLeft=0;game.score=[130,129];
  assert.equal(advancePeriod(game,teams),'finished');
  assert.deepEqual(teams.map(t=>t.timeouts),[2,5]);
});

test('regulation transitions and non-tied regulation finishes grant no timeouts',()=>{
  const teams=[{timeouts:1},{timeouts:0}];
  const game={quarter:1,period:'Q1',secondsLeft:0,score:[10,10]};
  for(let q=2;q<=4;q++){
    game.secondsLeft=0;
    assert.equal(advancePeriod(game,teams),'regulation');
    assert.equal(game.period,'Q'+q);
    assert.equal(game.secondsLeft,600);
    assert.equal(game.periodLength,600);
  }
  game.secondsLeft=0;game.score=[100,99];
  assert.equal(advancePeriod(game,teams),'finished');
  assert.deepEqual(teams.map(t=>t.timeouts),[1,0]);
});


test('all four Advanced quarters last 12 minutes while Basic remains 10 and overtime remains 3',()=>{
 for(const mode of ['basic','advanced']){
  const seconds=mode==='advanced'?720:600;
  assert.equal(regulationQuarterSeconds(mode),seconds);
  const teams=[{timeouts:6},{timeouts:6}];
  const game={quarter:1,period:'Q1',secondsLeft:seconds,periodLength:seconds,score:[0,0]};
  let elapsed=0;
  for(let q=1;q<=4;q++){
   assert.equal(game.quarter,q);assert.equal(game.secondsLeft,seconds);assert.equal(game.periodLength,seconds);
   elapsed+=game.secondsLeft;game.secondsLeft=0;
   assert.equal(advancePeriod(game,teams,mode),q===4?'overtime':'regulation');
  }
  assert.equal(elapsed,mode==='advanced'?2880:2400);
  assert.equal(game.secondsLeft,180);assert.equal(game.periodLength,180);assert.deepEqual(teams.map(t=>t.timeouts),[7,7]);
  game.secondsLeft=0;game.score=[100,99];assert.equal(advancePeriod(game,teams,mode),'finished');
 }
});
