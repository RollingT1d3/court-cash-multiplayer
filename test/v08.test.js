import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_THROUGH_POINT,CLOG_THE_LANES,pointRoles,pointPlay,clogPositions,clogInterceptionChance,
  CLOG_INTERCEPTION_FACTOR,CLOG_PAINT_SHOT_BONUS,CLOG_BLOCK_FACTOR} from '../strategy-v08.js';
import {mvpScore,dpogScore,gameAwards,gradeTeams} from '../awards-v08.js';
import {passingLaneDefenders,interceptionChance} from '../court-rules-v05.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const names=['pg','wing1','wing2','wing3','center'];
const stats={pg:{three:99,mid:75,passing:92},wing1:{three:80,mid:67},wing2:{three:94,mid:70},wing3:{three:87,mid:76},center:{three:60,mid:70,post:92,dunk:95,layup:92}};
const stat=(id,key)=>stats[id]?.[key]??65;
const rolls=(...vals)=>{let i=0;return ()=>vals[i++]??0;};

test('Point has a fixed PG/C and the two top THREE shooters from wing slots, not PG/C',()=>{
  assert.equal(PLAY_THROUGH_POINT,'Play Through Point');
  const r=pointRoles(names,stat);
  assert.deepEqual(r.corners,['wing2','wing3']);
  assert.equal(r.pg,'pg');assert.equal(r.center,'center');assert.equal(r.centerPreference,'roll');
});
test('Point runs PG drive and kick, center directly in paint, screen + roll, and wing cut/return',()=>{
  const kick=pointPlay(names,stat,rolls(0,.05));
  assert.equal(kick.action,'pg-kickout');assert.equal(kick.passer,'pg');
  assert.equal(kick.shooter,'wing2');assert.equal(kick.range,'three');assert.equal(kick.screen,true);
  const pg=pointPlay(names,stat,rolls(0,.3));
  assert.equal(pg.action,'pg-drive');assert.equal(pg.shooter,'pg');assert.equal(pg.range,'paint');
  const center=pointPlay(names,stat,rolls(0,.55));
  assert.equal(center.action,'center-direct');assert.equal(center.shooter,'center');
  assert.equal(center.range,'paint');
  const roll=pointPlay(names,stat,rolls(0,.73));
  assert.equal(roll.action,'center-roll');assert.equal(roll.shooter,'center');
  assert.equal(roll.screen,true);assert.equal(roll.passer,'pg');
  const cut=pointPlay(names,stat,rolls(0,.92,.5));
  assert.equal(cut.action,'wing-cut');assert.equal(cut.shooter,'wing2');
  assert.equal(cut.range,'paint');
  const noPass=pointPlay(names,stat,rolls(0,.92,.97));
  assert.equal(noPass.action,'wing-return');assert.equal(noPass.cutReturned,true);
  assert.equal(noPass.shooter,'pg');
});
test('center pops for 3PT or mid-range when better than inside finishing',()=>{
 const skill=(id,key)=>id==='center'?({three:94,mid:81,post:65,dunk:55,layup:62})[key]??0:stat(id,key);
 const r=pointPlay(names,skill,rolls(0,.77));
 assert.equal(r.centerPreference,'pop');assert.equal(r.action,'center-pop');
 assert.equal(r.range,'three');
 const mid=(id,key)=>id==='center'?({three:73,mid:97,post:70,dunk:58,layup:67})[key]??0:stat(id,key);
 assert.equal(pointPlay(names,mid,rolls(0,.77)).range,'mid');
});
test('Clog puts actual defenders in pass path, not at rim; multiplier never defeats 90+ pass immunity',()=>{
 assert.equal(CLOG_THE_LANES,'Clog The Lanes');
 assert.ok(CLOG_INTERCEPTION_FACTOR>=2);
 const defenders=['d1','d2','d3','d4','d5'];
 const from={x:.65,y:.5},to={x:.87,y:.51};
 const positions=clogPositions(from,to,defenders);
 const eligible=passingLaneDefenders(from,to,defenders,false,false,positions);
 assert.ok(eligible.length>=3);
 assert.ok(eligible.every(({id,at})=>Math.hypot(at.x-positions[id].x,at.y-positions[id].y)<1e-10));
 assert.ok(Object.values(positions).every(p=>p.x<=.82),'paint lane stays uncovered');
 const base=interceptionChance(100,89,true);
 assert.equal(base,.1);
 assert.equal(clogInterceptionChance(base,89),.25);
 assert.equal(clogInterceptionChance(base,90),0);
 assert.equal(interceptionChance(100,99,false),0);
 assert.ok(CLOG_PAINT_SHOT_BONUS>=.08);
 assert.ok(CLOG_BLOCK_FACTOR<1);
});
test('MVP must win and uses exactly PTS + AST + REB - TOV; DPOG can lose and share award',()=>{
 const teams=[{name:'W',roster:['a','b']},{name:'L',roster:['c','d']}];
 const stats={a:{pts:25,ast:7,reb:6,tov:5,stl:3,blk:2},b:{pts:18,ast:10,reb:9,tov:1,stl:0,blk:2},
 c:{pts:40,ast:12,reb:8,tov:2,stl:4,blk:5},d:{pts:3,ast:1,reb:6,tov:6,stl:1,blk:0}};
 assert.equal(mvpScore(stats.a),33);assert.equal(mvpScore(stats.b),36);
 assert.equal(dpogScore(stats.c),9);
 const awards=gameAwards(teams,stats,0);
 assert.equal(awards.mvp,'b');assert.equal(awards.dpog,'c');
 assert.equal(awards.mvpScore,36);assert.deepEqual(awards.mvpTop3.map(x=>x.label),['PTS','AST','REB']);
 const copy={...stats,c:{...stats.c,stl:0,blk:0},b:{...stats.b,stl:6,blk:6}};
 const both=gameAwards(teams,copy,0);
 assert.equal(both.mvp,'b');assert.equal(both.dpog,'b');
 assert.ok(both.grades.flatMap(g=>Object.values(g)).every(v=>Number.isInteger(v)&&v>=0&&v<=100));
});
test('team grades are bounded 0–100 even for extreme scores',()=>{
 const teams=[{roster:['a']},{roster:['b']}];
 const scores={a:{pts:700,reb:100,ast:100,stl:100,blk:90,fga:200,fgm:200},b:{pts:0,reb:0,ast:0,stl:0,blk:0,tov:100,fga:200,fgm:0,pf:100}};
 const {grades}=gradeTeams(teams,scores);
 assert.ok(grades.flatMap(g=>Object.values(g)).every(x=>x>=0&&x<=100));
});
test('UI and gameplay use exact requested labels, synchronized rematch and award image',()=>{
 const app=read('public/app.js'),server=read('server.js');
 assert.match(app,/SWISH!/);assert.match(app,/3PTS!/);
 assert.match(app,/event\.displayEvent==='mid'/);assert.match(app,/targetGoal,H\/2-58/);
 assert.match(app,/WINNER:/);assert.match(app,/🏆MVP🏆/);assert.match(app,/🔒DPOG🔒/);
 assert.match(app,/REMATCH!/);assert.match(app,/MAIN MENU/);assert.match(app,/returnToMainMenu/);
 assert.match(app,/award-portrait/);assert.match(app,/portrait\(p,'xl'/);
 assert.match(server,/case 'rematch'/);assert.match(server,/room\.rematchReady\.every\(Boolean\)/);
 assert.match(server,/gameAwards\(room\.teams,g\.stats,winner\)/);
 assert.match(server,/pointAction\.center/);assert.match(server,/CLOG_PAINT_SHOT_BONUS/);
 assert.match(server,/clogInterceptionChance/);
});
