import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offenseRoles, RUN_AND_GUN, OLD_SCHOOL_BUCKETS, threeDistanceFeet, longThreePenalty, isDeepThree } from '../offense-v04.js';

const stats={
  ace:{three:99,mid:85,rebound:25},
  blaze:{three:95,mid:82,rebound:35},
  cutter:{three:55,mid:89,rebound:59},
  screenA:{three:25,mid:37,rebound:98},
  screenB:{three:37,mid:41,rebound:90}
};
const get=(id,key)=>stats[id][key];
const ids=Object.keys(stats);

test('Run & Gun reserves two top 3PT scorers and identifies the two weakest combined shooters as screen/rebound-only',()=>{
  const roles=offenseRoles(ids,get);
  assert.deepEqual(roles.runShooters,['ace','blaze']);
  assert.deepEqual(roles.screenOnly,['screenA','screenB']);
  assert.equal(roles.runThird,'cutter');
  assert.equal(get(roles.runThird,'mid')>=80,true);
  assert.equal(roles.runShooters.some(id=>roles.screenOnly.includes(id)),false);
});

test('Old-School Buckets assigns best arc shooter, distinct paint rebounder and three cutters',()=>{
  const roles=offenseRoles(ids,get);
  assert.equal(roles.oldShooter,'ace');
  assert.equal(roles.oldRebounder,'screenA');
  assert.deepEqual(roles.oldCutters,['blaze','cutter','screenB']);
  // Even if the best 3PT shooter also rebounds the most, both roles still exist.
  stats.ace.rebound=120;
  const special=offenseRoles(ids,get);
  assert.equal(special.oldShooter,'ace');
  assert.equal(special.oldRebounder,'screenA');
  stats.ace.rebound=25;
});

test('deep-three model distinguishes regulation 3s, near-half, half-court and beyond; make penalty scales with distance',()=>{
  const deep=threeDistanceFeet(95,3,()=>0);
  const ordinary=threeDistanceFeet(95,18,()=>.999);
  assert.equal(deep,36);
  assert.equal(ordinary,30);
  assert.equal(longThreePenalty(ordinary),0);
  assert.ok(longThreePenalty(47)>longThreePenalty(36));
  assert.ok(longThreePenalty(60)>longThreePenalty(47));
  assert.equal(isDeepThree('three',true,36),true);
  assert.equal(isDeepThree('three',true,47),true);
  assert.equal(isDeepThree('three',true,58),true);
  assert.equal(isDeepThree('three',false,50),false);
  assert.equal(isDeepThree('mid',true,50),false);
  assert.equal(isDeepThree('three',true,30),false);
});

test('v0.4 front-end includes live new-strategy descriptions and both fire effects without any homepage picture edits',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  for(const name of [RUN_AND_GUN,OLD_SCHOOL_BUCKETS]){
    assert.ok(app.includes(`'${name}':`));
    assert.ok(server.includes(name===RUN_AND_GUN?'RUN_AND_GUN':'OLD_SCHOOL_BUCKETS'));
  }
  assert.ok(app.includes("'🔥FROM DEEP!🔥'"));
  assert.ok(app.includes("event?.deepThree&&shotEffectAge>=0&&shotEffectAge<1250&&id===event.shooter"));
  assert.ok(app.includes("ctx.fillText('🔥FROM DEEP!🔥',W/2,topShotEffectY+38)"));
  assert.ok(html.includes('Create a room') && html.includes('Join your friend'));
  assert.equal(html.includes('home-character-left'),false);
});
