import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heightContestAdjustment, heightBlockAdjustment } from '../height-rules-v083.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,'expected '+expected+', got '+actual);

test('v0.8.3: 3PT and mid-range height contest tiers',()=>{
  const cases=[[0,0],[1,0],[2,0],[3,.015],[5,.015],[6,.03],[8,.03],[9,.04],[11,.04],[12,.05],[20,.05]];
  for(const [adv,amount] of cases){
    for(const type of ['three','mid']){
      close(heightContestAdjustment(78+adv,78,type),amount);
      close(heightContestAdjustment(78,78+adv,type),-amount);
    }
  }
});

test('v0.8.3: layup and dunk height contest tiers are stronger',()=>{
  const cases=[[0,0],[2,0],[3,.025],[5,.025],[6,.045],[8,.045],[9,.06],[11,.06],[12,.08],[20,.08]];
  for(const [adv,amount] of cases){
    for(const type of ['layup','dunk']){
      close(heightContestAdjustment(78+adv,78,type),amount);
      close(heightContestAdjustment(78,78+adv,type),-amount);
    }
  }
});

test('v0.8.3: height alters interior block probability by at most 2pp',()=>{
  const cases=[[0,0],[1,0],[2,0],[3,.005],[5,.005],[6,.01],[8,.01],[9,.015],[11,.015],[12,.02],[25,.02]];
  for(const [adv,amount] of cases){
    close(heightBlockAdjustment(78,78+adv),amount);
    close(heightBlockAdjustment(78+adv,78),-amount);
  }
});

test('v0.8.3: engine uses one height contest, no stacked Pure Chaos size bonus, and keeps blocked shots interior-only',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/heightContestAdjustment\(getPlayer\(shooter\)\.heightInches,getPlayer\(defender\)\.heightInches,type\)/);
  assert.match(server,/base\+skillAdjustment\+heightContest-defenseBump/);
  assert.match(server,/heightBlockAdjustment\(getPlayer\(shooter\)\.heightInches,getPlayer\(defender\)\.heightInches\)/);
  assert.match(server,/blocked=!ankleBreaker&&inPaint&&rnd\(\)</);
  assert.doesNotMatch(server,/const sizeEdge=isInterior/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version,'0.8.3');
  assert.match(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),/ALPHA v0\.8\.3/);
});
