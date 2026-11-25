import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  FOUR_ONE_ZONE,TWO_TWO_ONE_ZONE,FOUR_ONE_ANCHORS,TWO_TWO_ONE_ANCHORS,
  FOUR_ONE_THREE_CONTEST,FOUR_ONE_MID_CONTEST,FOUR_ONE_PAINT_VULNERABILITY,
  TWO_TWO_ONE_EIGHT_SECOND_CHANCE,TWO_TWO_ONE_LANE_INTERCEPTION_FACTOR,
  zoneShotDefenseAdjustment,zoneDefendersForShot,twoTwoOneEightSecond,
  zoneLaneInterceptionChance,zoneOnBallStealChance,zoneAnchorOverrides
} from '../defense-v081.js';
import {passingLaneDefenders,interceptionChance} from '../court-rules-v05.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ids=['pg','sg','sf','pf','c'];

test('4-1 has FOUR outer defenders and one sole rim protector; outsides contested, paint vulnerable',()=>{
 assert.equal(FOUR_ONE_ZONE,'4-1 Zone');
 assert.equal(FOUR_ONE_ANCHORS.length,5);
 assert.ok(FOUR_ONE_ANCHORS.slice(0,4).every(p=>p.x<.75));
 assert.ok(FOUR_ONE_ANCHORS[4].x>.85);
 assert.deepEqual(zoneDefendersForShot(FOUR_ONE_ZONE,ids,true),['c']);
 assert.deepEqual(zoneDefendersForShot(FOUR_ONE_ZONE,ids,false),ids.slice(0,4));
 assert.equal(zoneShotDefenseAdjustment(FOUR_ONE_ZONE,'three'),FOUR_ONE_THREE_CONTEST);
 assert.equal(zoneShotDefenseAdjustment(FOUR_ONE_ZONE,'mid'),FOUR_ONE_MID_CONTEST);
 assert.equal(zoneShotDefenseAdjustment(FOUR_ONE_ZONE,'layup'),-FOUR_ONE_PAINT_VULNERABILITY);
 assert.equal(zoneShotDefenseAdjustment(FOUR_ONE_ZONE,'dunk'),-FOUR_ONE_PAINT_VULNERABILITY);
 assert.ok(FOUR_ONE_THREE_CONTEST>FOUR_ONE_MID_CONTEST);
});

test('2-2-1 has TWO front, TWO middle, ONE rear defender, with distinct full-court press odds',()=>{
 assert.equal(TWO_TWO_ONE_ZONE,'2-2-1 Zone');
 assert.equal(TWO_TWO_ONE_ANCHORS.length,5);
 const x=TWO_TWO_ONE_ANCHORS.map(p=>p.x);
 assert.deepEqual(x,[.39,.39,.61,.61,.88]);
 assert.deepEqual(zoneDefendersForShot(TWO_TWO_ONE_ZONE,ids,true),['c']);
 assert.deepEqual(zoneDefendersForShot(TWO_TWO_ONE_ZONE,ids,false),ids.slice(0,4));
 assert.equal(zoneShotDefenseAdjustment(TWO_TWO_ONE_ZONE,'three'),-.04);
 assert.equal(zoneShotDefenseAdjustment(TWO_TWO_ONE_ZONE,'mid'),-.04);
 assert.equal(zoneShotDefenseAdjustment(TWO_TWO_ONE_ZONE,'dunk'),-.04);
 assert.equal(TWO_TWO_ONE_EIGHT_SECOND_CHANCE,.04);
 assert.equal(twoTwoOneEightSecond(()=>.039999),true);
 assert.equal(twoTwoOneEightSecond(()=>.04),false);
 const total=Array.from({length:10000},(_,i)=>twoTwoOneEightSecond(()=>(i+.5)/10000)).filter(Boolean).length;
 assert.equal(total,400);
});

test('2-2-1 lane pressure applies only to geometric lane and NEVER bypasses 90+ passing immunity',()=>{
 assert.equal(TWO_TWO_ONE_LANE_INTERCEPTION_FACTOR,1.3);
 assert.equal(zoneLaneInterceptionChance(.04,89,TWO_TWO_ONE_ZONE),.052);
 assert.equal(zoneLaneInterceptionChance(.04,90,TWO_TWO_ONE_ZONE),0);
 assert.equal(zoneLaneInterceptionChance(.1,100,TWO_TWO_ONE_ZONE),0);
 assert.equal(zoneLaneInterceptionChance(0,89,TWO_TWO_ONE_ZONE),0);
 assert.equal(zoneLaneInterceptionChance(.04,89,FOUR_ONE_ZONE),.04);
 assert.equal(zoneOnBallStealChance(.03,TWO_TWO_ONE_ZONE),.034);
 assert.equal(zoneOnBallStealChance(.03,FOUR_ONE_ZONE),.03);
 for(const zone of [FOUR_ONE_ZONE,TWO_TWO_ONE_ZONE]){
   const pos=zoneAnchorOverrides(zone,ids);
   assert.equal(Object.keys(pos).length,5);
   const eligible=passingLaneDefenders({x:.16,y:.3},{x:.83,y:.3},ids,false,false,pos);
   for(const d of eligible){
     assert.ok(interceptionChance(85,80,true)>0);
     assert.equal(interceptionChance(100,90,true),0);
     assert.equal(interceptionChance(100,80,false),0);
   }
 }
 assert.equal(zoneAnchorOverrides('Man-to-Man',ids),null);
});

test('two new defenses selectable in menu and timeout; both modify real server outcomes',()=>{
 const server=read('server.js'),app=read('public/app.js');
 for(const name of [FOUR_ONE_ZONE,TWO_TWO_ONE_ZONE]){
   assert.ok(server.includes(name==='4-1 Zone'?'FOUR_ONE_ZONE':'TWO_TWO_ONE_ZONE'));
   assert.ok(app.includes(`'${name}'`));
 }
 assert.match(server,/defenseBump\+=zoneShotDefenseAdjustment\(dscheme,type\)/);
 assert.match(server,/zoneDefendersForShot\(dscheme,defenders,inPaint\)/);
 assert.match(server,/zoneLaneInterceptionChance\(baseLaneChance,passerRating,dscheme\)/);
 assert.match(server,/twoTwoOneEightSecond\(rnd\)/);
 assert.match(server,/zoneOnBallStealChance/);
 assert.match(app,/const isFourOne=/);
 assert.match(app,/const isTwoTwoOne=/);
 assert.match(app,/fourOneAnchors/);
 assert.match(app,/twoTwoOneAnchors/);
});

test('blocks produce a single brief hand emoji exactly between rendered blocker and shooter',()=>{
 const app=read('public/app.js');
 assert.match(app,/event\?\.displayEvent==='block'&&event\?\.blockId&&shotEffectAge>=0&&shotEffectAge<850/);
 assert.match(app,/canvasPositions\.has\(event\.blockId\)&&canvasPositions\.has\(event\.shooter\)/);
 assert.match(app,/const midX=\(defender\.x\+attacker\.x\)\/2,midY=\(defender\.y\+attacker\.y\)\/2/);
 assert.match(app,/ctx\.fillText\('🖐️',midX,midY\)/);
});

test('version is 0.8.2 and all previous v0.8 celebrations and rematch UI remain',()=>{
 const app=read('public/app.js'),html=read('public/index.html');
 assert.equal(JSON.parse(read('package.json')).version,'0.9.1');
 assert.match(html,/ALPHA v0\.9\.1/);
 assert.match(app,/SWISH!/);assert.match(app,/3PTS!/);
 assert.match(app,/🏆MVP🏆/);assert.match(app,/🔒DPOG🔒/);
 assert.match(app,/REMATCH!/);
});
