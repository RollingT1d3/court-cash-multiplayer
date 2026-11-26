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


test('visual movement uses individual Speed, Dribbling, Energy and strategy multipliers',()=>{
 const fresh=m.movementFactor({speed:75,dribbling:75},100,false);
 close(fresh,1);
 const quick=m.movementFactor({speed:99,dribbling:99},100,false);
 const slow=m.movementFactor({speed:60,dribbling:60},100,false);
 assert.ok(quick>slow);
 close(quick/slow,27.84/21.6);
 close(m.movementFactor({speed:75},0,false),.70);
 close(m.movementFactor({speed:75},50,false),.85);
 assert.ok(m.movementFactor({speed:90,dribbling:99},100,true)>m.movementFactor({speed:90,dribbling:60},100,true));
 close(m.movementFactor({speed:75},100,false,1.07),1.07);
 const start={x:100,y:250},target={x:850,y:250};
 const run=(factor,frame,count)=>{let p=start;for(let i=0;i<count;i++)p=m.movePlayer(p,target,frame,factor);return p;};
 assert.ok(run(quick,1000/60,30).x>run(slow,1000/60,30).x);
 assert.ok(run(quick,1000/60,30).x>run(quick*.7,1000/60,30).x);
 assert.ok(Math.abs(run(fresh,1000/60,30).x-run(fresh,1000/120,60).x)<4);
 const tr={kind:'advance',durationMs:1450};
 assert.ok(m.transitionPosition(tr,700,start,target,0,0,0,'p',940,525,1,quick).x>m.transitionPosition(tr,700,start,target,0,0,0,'p',940,525,1,slow).x);
 assert.ok(m.movePlayer({x:849,y:250},target,64,quick).x<=850);
});
test('dribbling slowdown follows possession rather than every player on offense',()=>{
 const event={transition:{kind:'advance',durationMs:1450,sourceId:'a',handlerId:'b'},passDurationMs:900,shooter:'c'};
 assert.equal(m.ballCarrier(event,300,null),'a');
 assert.equal(m.ballCarrier(event,1350,null),null);
 const pass={fromId:'b',toId:'c',outcome:'complete'};
 assert.equal(m.ballCarrier(event,1500,{pass,flying:false,received:false}),'b');
 assert.equal(m.ballCarrier(event,1600,{pass,flying:true,received:false}),null);
 assert.equal(m.ballCarrier(event,1800,{pass,flying:false,received:true}),'c');
 assert.equal(m.ballCarrier(event,1800,{pass:{...pass,outcome:'intercepted',interceptorId:'d'},flying:false,received:true}),'d');
 const app=read('public/app.js');
 assert.match(app,/motion\.movementFactor\(p\.stats,energy,carrier===id,strategyBoost\)/);
 assert.match(app,/motion\.movePlayer\(/);
});


test('normal jumpers gather tightly on the shooting side and release toward the correct basket',()=>{
 const p={x:500,y:250},g={x:880,y:262},duration=230;
 for(const direction of [1,-1]){
  const target=direction===1?g:{x:60,y:262};
  for(const type of ['mid','three']){
   const e={type,displayEvent:type,passDurationMs:300,jumperSetupMs:duration,made:true};
   const start=m.normalBall(e,300,p,null,target,direction);
   close(start.x,p.x+direction*16);close(start.y,p.y+12);
   const middle=m.normalBall(e,415,p,null,target,direction);
   assert.ok((middle.x-p.x)*direction>0&&middle.y<start.y);
   const release=m.normalBall(e,530,p,null,target,direction);
   close(release.x,p.x+direction*32/Math.sqrt(2));close(release.y,p.y-32/Math.sqrt(2));
   assert.equal(m.shotStart(e),530);assert.equal(m.shotEnd(e),1000);
   const flight=m.normalBall(e,540,p,null,target,direction);
   assert.ok((flight.x-release.x)*direction>0);
   close(m.normalBall(e,1000,p,null,target,direction).x,target.x);
   assert.equal(m.ballCarrier({...e,shooter:'p'},400,null),'p');
  }
 }
 for(const type of ['layup','dunk','putback'])assert.equal(m.shotStart({type,passDurationMs:300}),300);
 assert.equal(m.shotStart({type:'fade',passDurationMs:300,fadeSetupMs:720}),1020);
 const app=read('public/app.js'),server=read('server.js');
 assert.match(app,/motion\.setupBall\(event,d,resultAge,direction\)/);
 assert.match(server,/const jumperSetupMs=\['mid','three'\]\.includes\(type\)/);
});


test('made shots stay at the rim instead of drifting outward, in either direction',()=>{
 for(const direction of [1,-1]){
  const target={x:direction===1?880:60,y:260};
  for(const type of ['mid','three','fade','layup','dunk']){
   const e={type,made:true,displayEvent:type,passDurationMs:300,jumperSetupMs:['mid','three'].includes(type)?230:0,fadeSetupMs:type==='fade'?720:0};
   for(const extra of [0,85,170,600]){
    const ball=m.normalBall(e,m.shotEnd(e)+extra,shooter,null,target,direction);
    close(ball.x,target.x);close(ball.y,target.y);
   }
  }
  const put={putbackAttempt:true,putbackMade:true,made:true,reboundId:'p',rimBounces:2,displayEvent:'putback'};
  const ball=m.normalBall(put,m.putbackEnd(put)+600,shooter,rebounder,target,direction);
  close(ball.x,target.x);close(ball.y,target.y);
  const ft=m.freeThrowFrame([true],m.FT_START+800,shooter,target,direction);
  close(ft.ball.x,target.x);close(ft.ball.y,target.y);
  const miss=m.normalBall({displayEvent:'miss',reboundId:'p',rimBounces:1},m.SHOT_MS+90,shooter,rebounder,target,direction);
  assert.notEqual(miss.x,target.x);
 }
});


test('off-ball attackers advance into the frontcourt in both directions without teleporting',()=>{
 const W=940,anchor={x:.74,y:.2},back={x:170,y:105};
 const target=m.frontcourtSupportTarget(back,anchor,W);
 close(target.x,.74*W);close(target.y,105);
 close(m.frontcourtSupportTarget({x:800,y:120},anchor,W).x,800);
 for(const direction of [1,-1]){
  const start={x:direction===1?90:850,y:105};
  const dest={x:direction===1?target.x:W-target.x,y:target.y};
  let p=start;
  for(let i=0;i<60;i++)p=m.moveSupportPlayer(p,dest,1000/60,.7,W,direction);
  assert.ok(direction===1?p.x>W/2:p.x<W/2);
  assert.ok(Math.abs(p.x-dest.x)<Math.abs(start.x-dest.x));
 }
 const app=read('public/app.js');
 assert.match(app,/motion\.frontcourtSupportTarget/);
 assert.match(app,/motion\.moveSupportPlayer/);
});


test('offensive markers reach the attacking half by the animation deadline at different frame rates',()=>{
 const W=940;
 for(const direction of [1,-1])for(const fps of [30,60,120]){
  const dt=1000/fps,toScreen=x=>direction===1?x:W-x;
  let p={x:toScreen(20),y:250};
  for(let age=dt;age<1200;age+=dt){
   const next=m.movePlayer(p,{x:toScreen(730),y:250},dt,.35);
   const advanced=m.advanceOffensiveMarker(p,next,age,1200,dt,W,direction);
   assert.ok(toScreen(advanced.x)>=toScreen(p.x)-1e-8);
   p=advanced;
  }
  p=m.advanceOffensiveMarker(p,p,1200,1200,dt,W,direction);
  assert.ok(toScreen(p.x)>=.54*W-1e-8);
  const next=m.advanceOffensiveMarker(p,{x:toScreen(100),y:250},1250,1200,dt,W,direction);
  assert.ok(toScreen(next.x)>=.54*W-1e-8);
 }
});

test('actual drawCourt advances all five offensive markers during possession changes, including slow non-receivers',()=>{
 const app=read('public/app.js');
 const drawSource=app.slice(app.indexOf('  function drawCourt(ms){'),app.indexOf('  function drawInitials('));
 const W=940,H=525,active=[['a','b','c','d','e'],['f','g','h','i','j']];
 const stats={speed:35,dribbling:35};
 const ctx=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
 for(const offense of [0,1])for(const attackRight of [true,false])for(const mode of ['inbound','advance','outlet','hills']){
  let clock=0;
  const ids=active[offense],other=active[1-offense],toScreen=x=>attackRight?x:W-x;
  const shooter=ids[0],thief=ids[4],lead=mode==='outlet'?360:mode==='advance'?1450:1850;
  const ev={id:1,at:0,offense,attackRight,shooter,defender:other[0],type:'layup',displayEvent:'layup',made:true,points:2,
    shotDistanceFt:5,passes:[],passDurationMs:0,transition:{kind:mode==='outlet'||mode==='advance'?'advance':'inbound',reason:'basket',sourceId:thief,handlerId:shooter,inbounderId:thief,receiverId:shooter,durationMs:lead}};
  if(mode==='outlet'){
   const from={x:.15,y:.5},to={x:.40,y:.2};
   ev.passes=[{fromId:thief,toId:shooter,from,to,outcome:'complete',startMs:100,endMs:400,durationMs:300}];ev.passDurationMs=1200;
   ev.fastBreak={mode:'outlet',thief,afterMs:700,shotTarget:{x:.88,y:.5},
    starts:Object.fromEntries(ids.map(id=>[id,{x:.12,y:.5}])),
    targets:Object.fromEntries(ids.map((id,i)=>[id,{x:id===thief?.15:.75,y:.18+i*.16}])),recoveryTargets:{}};
  }
  if(mode==='hills'){ev.hillsInbounder=thief;ev.hillsRoutes=Object.fromEntries(ids.filter(id=>id!==thief).map((id,i)=>[id,{x:.85,y:.2+i*.18}]));}
  const state={code:'TEST',gameNumber:1,phase:'sim',game:{active,offense,quarter:1,event:ev},teams:active.map((five,i)=>({offense:mode==='hills'&&i===offense?'Run For The Hills':'Team Ball',defense:'Man-to-Man',energy:Object.fromEntries(five.map(id=>[id,0]))}))};
  const positions=new Map(active.flatMap((five,side)=>five.map((id,i)=>[id,{x:toScreen(side===offense?20:100),y:80+i*80}])));
  const env={state,canvasPositions:positions,courtImages:new Map(),frameRunning:true,transitionKey:'',transitionStarts:new Map(),previousBall:null,transitionBallStart:null,lastMotionFrame:null,syncOffset:0,
   Date:{now:()=>clock},performance:{now:()=>clock},$ :()=>({getContext:()=>ctx}),requestAnimationFrame:()=>{},
   window:{CourtMotion:m,CourtDesigns:{drawCourt:()=>{}},CourtHeadshots:{imageSource:()=>null}},
   colors:{hex:()=> '#555',ink:()=> '#fff'},colorFor:()=> 'blue',player:id=>({name:id,stats}),drawInitials:()=>{},courtReactionBurst:()=>{},
   ANKLE_STUMBLE_MS:1050,ANKLE_REACTIONS_MS:1150,POSTER_REACTIONS_MS:1250};
  runInNewContext(drawSource,env);
  const deadline=mode==='outlet'?lead+1200:lead+250;
  for(clock=0;clock<=deadline+20;clock+=10)env.drawCourt(clock);
  for(const id of ids){
   assert.ok((attackRight?positions.get(id).x:W-positions.get(id).x)>=.54*W-1e-7,mode+' '+id+' '+JSON.stringify(positions.get(id)));
  }
 }
});
