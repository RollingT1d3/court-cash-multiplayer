import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tallerTipoffChance, determineTipoff } from '../tipoff-v041.js';

const margins = new Map([
  [0,.50],[1,.55],[2,.55],[3,.65],[4,.80],[5,.80],
  [6,.90],[7,.95],[8,.95],[14,.95]
]);

test('opening tipoff heights have the exact requested probability brackets',()=>{
  for (const [gap,p] of margins){
    assert.equal(tallerTipoffChance(gap),p,`bad bracket at ${gap} inches`);
    const a=determineTipoff(72+gap,72,()=>.1);
    assert.equal(a.probabilities[0],p);
    assert.ok(Math.abs(a.probabilities[1]-(1-p))<1e-12);
    assert.equal(a.heightDifference,gap);
    const b=determineTipoff(72,72+gap,()=>.1);
    assert.ok(Math.abs(b.probabilities[0]-(1-p))<1e-12);
    assert.equal(b.probabilities[1],p);
  }
});

test('both sides can win; exact cutoff, shorter-player odds, ties and invalid heights',()=>{
  assert.equal(determineTipoff(79,79,()=>.4999).winningTeam,0);
  assert.equal(determineTipoff(79,79,()=>.5).winningTeam,1);
  assert.equal(determineTipoff(84,77,()=>.94999).winningTeam,0);
  assert.equal(determineTipoff(84,77,()=>.95).winningTeam,1);
  assert.equal(determineTipoff(77,84,()=>.04999).winningTeam,0);
  assert.equal(determineTipoff(77,84,()=>.05).winningTeam,1);
  assert.throws(()=>determineTipoff(null,80),/valid heights/);
  assert.throws(()=>determineTipoff(80,80.5),/valid heights/);
  assert.throws(()=>determineTipoff(80,80,()=>1),/Random/);
  assert.throws(()=>tallerTipoffChance(-1),/nonnegative/);
});

test('v0.4.1 game applies center heights, sends winning team first, and displays a tipoff notice',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.ok(server.includes('const centerIds=active.map(five=>five[4])'));
  assert.ok(server.includes('const result=determineTipoff(centerHeights[0],centerHeights[1],rnd)'));
  assert.ok(server.includes('offense:result.winningTeam'));
  assert.ok(app.includes('TIP-OFF WON:'));
  assert.ok(app.includes('g.tipoff.probabilities[g.tipoff.winningTeam]'));
});
