import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const browser={};runInNewContext(read('public/court-motion.js'),{window:browser});
const m=browser.CourtMotion,goal={x:880,y:260},shooter={x:650,y:260},rebounder={x:810,y:300};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
test('one to three rim bounces occur before ball reaches actual rebounder; putback follows rebound',()=>{
 for(const count of [1,2,3]){
  const e={passDurationMs:300,rimBounces:count,reboundId:'p',displayEvent:'miss'};
  const end=m.shotEnd(e);
  for(let i=0;i<count;i++){const at=m.normalBall(e,end+i*180+90,shooter,rebounder,goal,1);assert.ok(at.y<goal.y);assert.notEqual(at.x,goal.x);}
  const caught=m.normalBall(e,m.reboundEnd(e),shooter,rebounder,goal,1);close(caught.x,rebounder.x+15);
  const put={...e,putbackAttempt:true,putbackMade:true,displayEvent:'putback'};
  close(m.normalBall(put,m.reboundEnd(put),shooter,rebounder,goal,1).x,rebounder.x);
  close(m.normalBall(put,m.putbackEnd(put),shooter,rebounder,goal,1).x,goal.x);
  assert.ok(m.putbackEnd(put)+750<3250);
 }
});
test('free throws reveal each authoritative result only at rim arrival and fit the possession window',()=>{
 const results=[true,false,true];
 for(let i=0;i<3;i++){
  const start=m.FT_START+i*m.FT_STEP;
  const pre=m.freeThrowFrame(results,start+200,shooter,goal,1);
  assert.equal(pre.index,i);assert.equal(pre.revealed,false);
  const post=m.freeThrowFrame(results,start+560,shooter,goal,1);
  assert.equal(post.index,i);assert.equal(post.made,results[i]);assert.equal(post.revealed,true);
 }
 assert.ok(m.FT_START+3*m.FT_STEP<3250);
});
test('jump ball ends toward the actual tip winner; timing and integration are wired',()=>{
 const a=m.tipFrame(1800,940,525,0),b=m.tipFrame(1800,940,525,1);
 assert.ok(a.ball.x<470&&b.ball.x>470);assert.ok(a.won&&b.won);
 const app=read('public/app.js'),server=read('server.js'),html=read('public/index.html');
 assert.match(app,/shotEffectAge<850/);assert.match(app,/shotEffectAge<1250/);
 assert.match(app,/putbackEffectAge<750/);assert.match(app,/'PUTBACK!'/);
 assert.match(app,/motion\.freeThrowFrame/);assert.match(app,/motion\.tipFrame/);
 assert.match(server,/freeThrowResults/);assert.match(server,/finishAfterAnimation/);
 assert.ok(html.indexOf('/court-motion.js')<html.indexOf('/app.js'));
});
