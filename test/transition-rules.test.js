import test from 'node:test';
import assert from 'node:assert/strict';
import { possessionTransition, possessionWindow } from '../transition-rules.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const active=['pg','sg','sf','pf','c'];
const tr=(p,q=1,timeout=false,hills=null)=>possessionTransition(p,0,q,active,timeout,'pg',hills);
test('inbound only for dead balls, makes, periods and timeouts; rebounds and steals advance live',()=>{
 for(const p of [{made:true},{displayEvent:'putback',made:true},{displayEvent:'illegal-screen'},{displayEvent:'pass-out-of-bounds'},{displayEvent:'eight-second-violation'},{foul:true,freeThrowResults:[false,true]}])assert.equal(tr(p).kind,'inbound');
 assert.equal(tr({quarter:1},2).reason,'period');
 assert.equal(tr({reboundId:'c',offense:0},1,true).reason,'timeout');
 assert.equal(tr({reboundId:'c',offense:1}).kind,'advance');
 assert.equal(tr({reboundId:'c',offense:0}).kind,'reset');
 assert.equal(tr({stealId:'sg',offense:1}).sourceId,'sg');
 assert.equal(tr({foul:true,freeThrowResults:[true,false],offense:1}).kind,'advance');
 assert.equal(tr(null).reason,'tip');
 assert.equal(tr({made:true},1,false,'sg').inbounderId,'sg');
});
test('transition lead plus shot effects fit the next possession deadline without affecting fast tests',()=>{
 const e={transition:{durationMs:1850},passDurationMs:1700,deepThree:true};
 assert.ok(possessionWindow(e,3250)>=1850+1700+470+1250);
 assert.equal(possessionWindow(e,10),10);
 const p={...e,putbackAttempt:true,rimBounces:3};
 assert.ok(possessionWindow(p,3250)>=1850+1700+470+540+260+300+750);
});
test('inbound pass starts outside the baseline and the receiver smoothly advances, mirrored for either direction',()=>{
 const browser={};runInNewContext(readFileSync(new URL('../public/court-motion.js',import.meta.url),'utf8'),{window:browser});
 const m=browser.CourtMotion, t=tr({made:true});
 const start={x:100,y:250},target={x:750,y:260};
 for(const direction of [1,-1]){
  const inbound=m.transitionPosition(t,500,start,target,0,0,4,'c',940,525,direction);
  assert.equal(inbound.x,direction===1?9:931);
  const mid=m.transitionPosition(t,1200,start,target,0,0,0,'pg',940,525,direction);
  assert.ok(mid.x>0&&mid.x<940);
  const end=m.transitionPosition(t,t.durationMs,start,target,0,0,0,'pg',940,525,direction);
  assert.equal(end.x,target.x);assert.equal(end.y,target.y);
  const pos=new Map([['c',inbound],['pg',{x:direction===1?179:761,y:262}]]);
  const pass=m.transitionBall(t,485,pos,direction,null);
  assert.ok(pass.x>Math.min(inbound.x,pos.get('pg').x)&&pass.x<Math.max(inbound.x,pos.get('pg').x));
 }
});
