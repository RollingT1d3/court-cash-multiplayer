import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {individualDefenseContest} from '../defense-contest.js';
import {fatiguedSkill} from '../fatigue-v084.js';
import {heightContestAdjustment} from '../height-rules-v083.js';

const bands=[[0,40,.001],[41,49,.004],[50,52,.005],[53,53,.007],[54,58,.008],[59,59,.0085],[60,64,.009],[65,69,.0099],[70,72,.01],[73,74,.02],[75,79,.025],[80,84,.03],[85,88,.035],[89,89,.04],[90,90,.045],[91,92,.049],[93,96,.05],[97,98,.055],[99,99,.059],[100,100,.06]];
test('all 101 integer defense ratings match the approved contest brackets',()=>{
  for(const [min,max,expected] of bands)for(let rating=min;rating<=max;rating++)assert.equal(individualDefenseContest(rating),expected,'rating '+rating);
  for(let rating=0;rating<=100;rating++){
    assert.ok(individualDefenseContest(rating)>0);
    if(rating>0)assert.ok(individualDefenseContest(rating)>=individualDefenseContest(rating-1));
  }
});
test('fractional fatigue ratings round to nearest bracket and never grant a shooting bonus',()=>{
  assert.equal(individualDefenseContest(72.49),.01);
  assert.equal(individualDefenseContest(72.5),.02);
  assert.equal(individualDefenseContest(99.5),.06);
  assert.equal(individualDefenseContest(-5),.001);
  assert.equal(individualDefenseContest(105),.06);
  assert.equal(individualDefenseContest(fatiguedSkill(90,50,'defense')),.035);
  for(let energy=0;energy<=100;energy++)for(let rating=0;rating<=100;rating++)assert.ok(individualDefenseContest(fatiguedSkill(rating,energy,'defense'))>0);
});
test('95 three-point shooter has 58% base; same-height contest reduces it with existing height adjustments separate',()=>{
  for(const [rating,expected] of [[40,.579],[75,.555],[90,.535],[100,.52]]){
    assert.ok(Math.abs(.58-individualDefenseContest(rating)-expected)<1e-12);
  }
  assert.ok(Math.abs(.58-individualDefenseContest(90)+heightContestAdjustment(72,78,'three')-.505)<1e-12);
});
test('live shot resolution uses the bracket for both paint and perimeter; block and strategy formulas are preserved',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.ok(server.includes("const defensiveRating=defensiveSkill(room,def,defender,inPaint?'paintDef':'perimeterDef');"));
  assert.ok(server.includes('let defenseBump=individualDefenseContest(defensiveRating);'));
  assert.ok(!server.includes('(defensiveRating-75)*.0018'));
  assert.ok(server.includes("defensiveSkill(room,def,defender,'block')-75)*.0018"));
  assert.ok(server.includes('defenseBump+=zoneShotDefenseAdjustment(dscheme,coverageType)'));
  assert.ok(server.includes('base+skillAdjustment+heightContest-defenseBump'));
});
