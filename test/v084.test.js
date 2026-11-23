import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fatigueMultiplier, fatiguedSkill, timeoutRecovery } from '../fatigue-v084.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,'expected '+expected+' got '+actual);

test('v0.8.4 shooting, finishing and defense fatigue scale continuously',()=>{
  for(const [category,cap] of [['shooting',.18],['finishing',.12],['defense',.10]]){
    for(const energy of [0,25,50,75,100]){
      const factor=1-cap*(1-energy/100);
      close(fatigueMultiplier(category,energy),factor);
      close(fatiguedSkill(90,energy,category),90*factor);
    }
    close(fatigueMultiplier(category,-20),1-cap);
    close(fatigueMultiplier(category,120),1);
  }
});

test('v0.8.4 passing and dribbling are unaffected by fatigue',()=>{
  for(const energy of [0,12,50,99,100]){
    close(fatiguedSkill(95,energy,'passing'),95);
    close(fatiguedSkill(95,energy,'dribbling'),95);
  }
});

test('v0.8.4 timeouts grant four energy once, with a cap at 100',()=>{
  for(const [before,after] of [[0,4],[24,28],[50,54],[95,99],[96,100],[99,100],[100,100]]){
    close(timeoutRecovery(before),after);
  }
});

test('v0.8.4 server correctly applies each fatigue category and manual substitutions',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/function effective\(id,team,skill,category\)/);
  assert.match(server,/effective\(shooter,ot,value,inPaint\?'finishing':'shooting'\)/);
  assert.match(server,/function defensiveSkill\(room,side,id,key\)/);
  assert.match(server,/defensiveSkill\(room,def,defender,inPaint\?'paintDef':'perimeterDef'\)/);
  assert.match(server,/defensiveSkill\(room,def,defender,'block'\)/);
  assert.match(server,/fatiguedSkill\(rating\(defender,'steal'\)/);
  assert.match(server,/fatiguedSkill\(rating\(lanePlayer\.id,'steal'\)/);
  assert.doesNotMatch(server,/automaticSubs/);
  assert.match(server,/team\.energy\[id\]=timeoutRecovery\(team\.energy\[id\]\?\?100\)/);
  assert.match(server,/room\.timeout\?\.caller!==i/);
  assert.match(server,/room\.phase!=='foulout'/);
});

test('v0.8.4 fatigue emoji thresholds, small portrait overlay and exact-energy detail',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/if\(e<60\)/);
  assert.match(app,/e<25\?'🥵':'💦'/);
  assert.match(app,/badgeX=prev\.x\+16,badgeY=prev\.y-16/);
  assert.match(app,/ctx\.font='12px system-ui'/);
  assert.match(app,/⚡ Energy:/);
  assert.doesNotMatch(app,/if\(e<80\)/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version,'0.8.41');
  assert.match(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),/ALPHA v0\.8\.41/);
});
