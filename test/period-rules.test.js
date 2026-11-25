import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePeriod } from '../period-rules.js';

test('every overtime awards one timeout per team, preserving unused timeouts',()=>{
  const teams=[{timeouts:0},{timeouts:2}];
  const game={quarter:4,period:'Q4',secondsLeft:0,score:[100,100]};
  assert.equal(advancePeriod(game,teams),'overtime');
  assert.equal(game.period,'OT1');
  assert.equal(game.secondsLeft,300);
  assert.deepEqual(teams.map(t=>t.timeouts),[1,3]);
  assert.equal(advancePeriod(game,teams),'playing');
  assert.deepEqual(teams.map(t=>t.timeouts),[1,3]);
  teams[0].timeouts--;
  game.secondsLeft=0;game.score=[110,110];
  assert.equal(advancePeriod(game,teams),'overtime');
  assert.equal(game.period,'OT2');
  assert.equal(game.secondsLeft,300);
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
    assert.equal(game.secondsLeft,720);
  }
  game.secondsLeft=0;game.score=[100,99];
  assert.equal(advancePeriod(game,teams),'finished');
  assert.deepEqual(teams.map(t=>t.timeouts),[1,0]);
});
