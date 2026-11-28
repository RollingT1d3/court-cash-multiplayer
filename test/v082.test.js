import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { threePointBaseChance, longThreePenalty, threeDistanceFeet } from '../offense-v04.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,'expected '+expected+', got '+actual);

test('v0.8.2: listed three-point ratings map to every specified base probability',()=>{
  const cases=[
    [0,.15],[58,.15],[59,.15],[60,.25],[69,.25],
    [70,.30],[75,.30],[76,.39],[79,.39],[80,.40],
    [81,.45],[85,.45],[86,.49],[89,.49],[90,.50],
    [91,.55],[92,.55],[93,.575],[94,.575],[95,.58],
    [98,.58],[99,.585],[100,.59]
  ];
  for(const [rating,pct] of cases)close(threePointBaseChance(rating),pct);
  close(threePointBaseChance(101),.59);
  close(threePointBaseChance(-20),.15);
});

test('v0.8.2: ordinary three-point shooters use user-specified distance penalties',()=>{
  const cases=[[23,0],[30,0],[35,0],[36,.05],[40,.10],[45,.15],[50,.20],[55,.25],[60,.30],[62,.35],[70,.35]];
  for(const [feet,penalty] of cases){
    close(longThreePenalty(feet,80),penalty);
    close(longThreePenalty(feet,94),penalty);
    close(longThreePenalty(feet),penalty);
  }
  close(longThreePenalty(38,80),.075);
  close(longThreePenalty(42.5,80),.125);
});

test('v0.8.2: 95–99 and 100 tiers get the agreed elite deep-shot penalties',()=>{
  const elite=[[36,0],[40,.02],[45,.04],[50,.06],[55,.09],[60,.12],[62,.15]];
  const perfect=[[36,0],[40,0],[45,.01],[50,.02],[55,.03],[60,.05],[62,.07]];
  for(const [feet,penalty] of elite){
    close(longThreePenalty(feet,95),penalty);
    close(longThreePenalty(feet,99),penalty);
  }
  for(const [feet,penalty] of perfect)close(longThreePenalty(feet,100),penalty);
  close(longThreePenalty(42.5,97),.03);
  close(longThreePenalty(57.5,100),.04);
  for(let feet=36;feet<=62;feet++){
    assert.ok(longThreePenalty(feet,100)<=longThreePenalty(feet,99));
    assert.ok(longThreePenalty(feet,99)<=longThreePenalty(feet,94));
  }
});

test('v0.8.2: new accuracy formula is connected to gameplay; existing shot generation remains',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/threePointBaseChance\(rawThree\)/);
  assert.match(server,/longThreePenalty\(shotDistanceFt,rawThree\)/);
  assert.match(server,/skillAdjustment=\(value-\(isThree\?rawThree:80\)\)\*\.0075/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version,'1.2.0');
  assert.match(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),/ALPHA v1\.2/);
  assert.equal(threeDistanceFeet(95,18,()=>.999),30);
  assert.equal(threeDistanceFeet(95,3,()=>0),36);
});
