import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ankleBreakerBase, ankleDefenseReduction, ankleBreakerChance, ankleBreaks,
  ANKLE_OPEN_SHOT_BONUS, ANKLE_STUMBLE_MS, ANKLE_REACTIONS_MS, POSTER_REACTIONS_MS
} from '../ankle-rules-v07.js';

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('dribbling creates exactly the specified ankle-breaker base odds at every bracket edge',()=>{
  const cases=[
    [0,0],[79,0],[80,.01],[81,.015],[85,.015],[86,.02],[89,.02],
    [90,.03],[91,.04],[94,.04],[95,.045],[98,.045],[99,.048],[100,.05]
  ];
  for(const [handle,expect] of cases)assert.equal(ankleBreakerBase(handle),expect,`dribbling ${handle}`);
});

test('perimeter defense has exact percentage-point reduction, including 99+ absolute immunity',()=>{
  const cases=[
    [0,0],[79,0],[80,.005],[81,.01],[85,.01],[86,.02],[89,.02],
    [90,.03],[91,.035],[95,.035],[96,.04],[98,.04],
    [99,Infinity],[100,Infinity]
  ];
  for(const [perimeter,expect] of cases)assert.equal(ankleDefenseReduction(perimeter),expect,`perimeter ${perimeter}`);
  assert.equal(ankleBreakerChance(100,99),0);
  assert.equal(ankleBreakerChance(100,100),0);
  assert.equal(ankleBreakerChance(99,100),0);
});

test('subtraction is in percentage points, never negative or an extra multiplier',()=>{
  assert.equal(ankleBreakerChance(100,80),.045);
  assert.equal(ankleBreakerChance(100,98),.01);
  assert.equal(ankleBreakerChance(99,91),.013);
  assert.equal(ankleBreakerChance(80,90),0);
  assert.equal(ankleBreakerChance(95,91),.01);
  assert.equal(ankleBreakerChance(86,86),0);
  assert.equal(ankleBreakerChance(79,20),0);
});

test('event roll happens on an actual basketball possession, and exact boundary is exclusive',()=>{
  assert.equal(ankleBreaks(100,79,()=>.049999),true);
  assert.equal(ankleBreaks(100,79,()=>.05),false);
  assert.equal(ankleBreaks(100,100,()=>0),false);
  assert.equal(ankleBreaks(70,0,()=>0),false);
  assert.equal(ANKLE_OPEN_SHOT_BONUS,.12);
  assert.ok(ANKLE_STUMBLE_MS<=1500);
  assert.ok(ANKLE_REACTIONS_MS<=1500);
  assert.ok(POSTER_REACTIONS_MS<=1500);
});

test('server records the exact handler, defender, short open-shot bonus and no contest/block',()=>{
  const server=read('server.js');
  assert.match(server,/ankleBreaks\(rating\(shooter,'dribbling'\),rating\(defender,'perimeterDef'\),rnd\)/);
  assert.match(server,/g\.stats\[shooter\]\.ankleBreaks\+\+/);
  assert.match(server,/ankleBreaker\?ANKLE_OPEN_SHOT_BONUS:0/);
  assert.match(server,/blocked=!ankleBreaker&&inPaint/);
  assert.match(server,/foulChance=ankleBreaker\?0:/);
  assert.match(server,/ankleBreakerHandler:ankleBreaker\?shooter:null/);
  assert.match(server,/ankleBreakerDefender:ankleBreaker\?defender:null/);
});

test('timeouts require server-side possession and preserve the ball on both resume paths',()=>{
  const server=read('server.js');
  const app=read('public/app.js');
  assert.match(server,/if\(room\.game\?\.offense!==i\)throw Error\('Your team must have the ball/);
  assert.match(server,/room\.timeout=\{caller:i,possession:i,until:now\(\)\+30000\}/);
  assert.equal((server.match(/room\.game\.offense=room\.timeout\.possession/g)||[]).length,2);
  assert.equal((server.match(/room\.game\.timeoutInboundSide=room\.timeout\.possession/g)||[]).length,2);
  assert.match(server,/possessionTransition\(g\.event,offense,g\.quarter,shooters,inboundAfterTimeout,firstHandler/);
  const transition=read('transition-rules.js');
  assert.match(transition,/if\(timeout\)\{kind='inbound';reason='timeout';\}/);
  assert.match(app,/state\.game\.offense!==state\.you/);
  assert.match(app,/INBOUND AFTER TIMEOUT/);
});

test('poster fires are replaced with requested distinct dunker/defender/hoop/crowd emoji effects',()=>{
  const app=read('public/app.js');
  const start=app.indexOf("if(!transitioning&&event?.posterDunk&&resultAge>=0&&resultAge<POSTER_REACTIONS_MS){");
  const end=app.indexOf("if(!transitioning&&resultAge>=0&&event?.ankleBreaker&&state.phase",start);
  assert.ok(start>=0&&end>start);
  const portraitEffects=app.slice(start,end);
  assert.ok(portraitEffects.includes("ctx.fillText('🗣️'"));
  assert.ok(portraitEffects.includes("ctx.fillText('😢'"));
  assert.ok(!portraitEffects.includes("fillText('🔥'"));
  assert.match(app,/ctx\.fillText\('💪',W\/2,topShotEffectY\)/);
  assert.match(app,/\['📸😯','📸','🫪'\]/);
  assert.match(app,/\['🫪','😱','😯'\]/);
  assert.match(app,/ctx\.rotate\(\(pos%2\?1:-1\)\*\.32\*spin\)/);
  assert.match(app,/ctx\.fillText\('😵‍💫',prev\.x,prev\.y-44\)/);
});
