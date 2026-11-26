import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  RUN_FOR_THE_HILLS,FULL_COURT_PRESS,HILLS_SPEED_MULTIPLIER,
  HILLS_STAMINA_MULTIPLIER,PRESS_DEFENSE_STAMINA_MULTIPLIER,
  PRESS_OFFENSE_STAMINA_MULTIPLIER,PRESS_STEAL_BONUS,
  EIGHT_SECOND_VIOLATION_CHANCE,HILLS_OFFENSIVE_REBOUND_BONUS,
  HILLS_PUTBACK_CHANCE,hillsInbounder,hillsRoutes,pressForcesEightSeconds,
  pressOnBallChance,hillsOffensiveReboundChance,pickHillsPutback,PRESS_DEFENSE_ANCHORS
} from '../strategy-v06.js';
import {passingLaneDefenders} from '../court-rules-v05.js';

const players=['pg','wing','pointForward','big','shooter'];
const skills={
 pg:{passing:100,three:88,mid:75},wing:{passing:76,three:99,mid:76},
 pointForward:{passing:91,three:77,mid:84},big:{passing:70,three:36,mid:50},
 shooter:{passing:85,three:78,mid:98}
};
const stat=(id,key)=>skills[id]?.[key]??75;

test('v0.6 names and deliberate strategy tradeoff parameters',()=>{
  assert.equal(RUN_FOR_THE_HILLS,'Run For The Hills');
  assert.equal(FULL_COURT_PRESS,'Full Court Press');
  assert.equal(HILLS_SPEED_MULTIPLIER,1.07);
  assert.equal(HILLS_STAMINA_MULTIPLIER,1.14);
  assert.equal(PRESS_DEFENSE_STAMINA_MULTIPLIER,1.75);
  assert.equal(PRESS_OFFENSE_STAMINA_MULTIPLIER,1.16);
  assert.equal(PRESS_STEAL_BONUS,.008);
  assert.equal(EIGHT_SECOND_VIOLATION_CHANCE,.10);
  assert.equal(HILLS_OFFENSIVE_REBOUND_BONUS,.08);
  assert.equal(HILLS_PUTBACK_CHANCE,.50);
});

test('Run For The Hills inbounder is the best listed passer who is NOT the starting PG',()=>{
  assert.equal(hillsInbounder(players,stat),'pointForward');
  assert.equal(hillsInbounder(['pg','wing','shooter','big','pointForward'],stat),'pointForward');
  assert.throws(()=>hillsInbounder(['pg'],stat),/Five active/);
});

test('four runners have unique shuffled lanes; best available two shooters flare out',()=>{
  const res=hillsRoutes(players,'pointForward',stat,()=>.2);
  assert.deepEqual(res.shooters,['wing','shooter']);
  assert.deepEqual(res.paintPlayers,['pg','big']);
  assert.equal(res.inbounder,'pointForward');
  assert.equal(res.runners.length,4);
  assert.equal(Object.keys(res.targets).length,4);
  assert.ok(!res.targets.pointForward);
  assert.equal(new Set(Object.values(res.targets).map(({y})=>y)).size,4);
  assert.equal(res.perimeterShot,true);
  assert.ok(res.shooters.includes(res.shooter));
  assert.ok(res.shooters.every(id=>res.targets[id].x<.73));
  assert.ok(res.paintPlayers.every(id=>res.targets[id].x>.80));
});

test('paint-crash route ends in a drive for layup/dunk, not a perimeter jumper',()=>{
  const res=hillsRoutes(players,'pointForward',stat,()=>.99);
  assert.equal(res.wantsKickout,false);
  assert.equal(res.paintCrash,true);
  assert.equal(res.perimeterShot,false);
  assert.ok(res.paintPlayers.includes(res.shooter));
});

test('failed kickout sends the ball back to paint; successful kickout shoots 3 or mid',()=>{
  const sequence=[.5,.5,.5,.4,.9,.5,.5,.5,.5,.5,.5];
  const fail=hillsRoutes(players,'pointForward',stat,()=>sequence.shift()??.5);
  assert.equal(fail.wantsKickout,true);
  assert.equal(fail.kickoutCaught,false);
  assert.equal(fail.perimeterShot,false);
  assert.ok(fail.paintPlayers.includes(fail.shooter));
  const success=hillsRoutes(players,'pointForward',stat,()=>.2);
  assert.ok(success.shooters.includes(success.shooter));
  assert.equal(success.perimeterShot,true);
  assert.equal(stat('wing','three')>stat('wing','mid'),true);
  assert.equal(stat('shooter','mid')>stat('shooter','three'),true);
});

test('full court press has an exact 10% possession-level eight-second violation check',()=>{
  const n=10000;
  const total=Array.from({length:n},(_,i)=>pressForcesEightSeconds(()=>(i+.5)/n)).filter(Boolean).length;
  assert.equal(total,1000);
  assert.equal(pressForcesEightSeconds(()=>.099999),true);
  assert.equal(pressForcesEightSeconds(()=>.10),false);
});

test('press adds a small on-ball steal bonus; no press leaves exact v0.5 table unchanged',()=>{
  assert.equal(pressOnBallChance(.03,false),.03);
  assert.equal(pressOnBallChance(.03,true),.038);
  assert.equal(pressOnBallChance(0,true),.008);
  assert.equal(pressOnBallChance(1,true),1);
});

test('hills players are aggressive offensive rebounders and can try putbacks',()=>{
  assert.equal(hillsOffensiveReboundChance(.26,false),.34);
  assert.ok(Math.abs(hillsOffensiveReboundChance(.20,true)-.24)<1e-12);
  assert.equal(pickHillsPutback(()=>.49),true);
  assert.equal(pickHillsPutback(()=>.50),false);
});

test('press defenders align farther up the court in the press lane, not a halfcourt zone',()=>{
  const ids=['d1','d2','d3','d4','d5'];
  const from={x:.18,y:.5},to={x:.86,y:.5};
  const press=passingLaneDefenders(from,to,ids,false,true);
  assert.equal(PRESS_DEFENSE_ANCHORS.length,5);
  assert.ok(press.some(p=>p.id==='d1'&&p.at.x<.5));
  assert.ok(press.every(p=>p.at.x<.65));
  // 90+ Passing immunity from v0.5 still holds, even with this geometry.
});

test('strategies are selectable on both clients; server handles route/press/putback outcomes',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(server,/RUN_FOR_THE_HILLS,PLAY_THROUGH_POINT\]/);
  assert.match(server,/FULL_COURT_PRESS,CLOG_THE_LANES,FOUR_ONE_ZONE,TWO_TWO_ONE_ZONE,BOX_AND_ONE\]/);
  assert.match(server,/hills\?hillsPlay\.inbounder/);
  assert.match(server,/pressForcesEightSeconds\(rnd\)/);
  assert.match(server,/g\.stats\[passerId\|\|shooter\]\.tov\+\+/);
  assert.match(server,/g\.stats\[reboundId\]\.fga\+\+/);
  assert.match(server,/putbackMade=true;made=true;points=2/);
  assert.match(server,/HILLS_STAMINA_MULTIPLIER/);
  assert.match(server,/PRESS_DEFENSE_STAMINA_MULTIPLIER/);
  assert.match(app,/hillsRoutes/);
  assert.match(app,/FULL COURT PRESS|Full Court Press/);
  assert.match(app,/8 SECOND VIOLATION/);
  assert.match(html,/ALPHA v1\.1/);
});
