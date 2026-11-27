import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {offenseRoles,runGunCandidates} from '../offense-v04.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const browser={};runInNewContext(read('public/court-motion.js'),{window:browser});
const m=browser.CourtMotion,W=940,H=525,ids=['a','b','c','d','e'],def=['f','g','h','i','j'];
const plain=x=>JSON.parse(JSON.stringify(x));
test('Run & Gun third scorer requires 80 MID; only top two shooters remain when ineligible',()=>{
 let mid=79;const stat=(id,k)=>k==='three'?({a:99,b:95,c:78,d:50,e:40}[id]):k==='mid'?(id==='c'?mid:60):75;
 const roles=offenseRoles(ids,stat);assert.deepEqual(runGunCandidates(roles,stat),['a','b']);mid=80;assert.deepEqual(runGunCandidates(roles,stat),['a','b','c']);
 const server=read('server.js');assert.match(server,/runGun\?runGunCandidates\(roles,rating\)/);assert.match(server,/runGun&&shooter===roles.runThird\?'mid'/);
});
test('defensive assignments remain unique in man coverage; double team has exactly two star defenders and preserves the non-star contest',()=>{
 const man=m.tacticalAssignments('Man-to-Man',ids,def,'a','b','j');assert.equal(new Set(Object.values(man)).size,5);assert.equal(man.j,'b');
 const double=m.tacticalAssignments('Double the Star',ids,def,'a','b','j');assert.equal(Object.values(double).filter(x=>x==='a').length,2);assert.equal(double.j,'b');
 const onStar=m.tacticalAssignments('Double the Star',ids,def,'a','a','j');assert.equal(onStar.j,'a');assert.equal(Object.values(onStar).filter(x=>x==='a').length,2);
});
test('tactical targets distinguish paint, perimeter, man and double coverage; screen approaches actual handler',()=>{
 const locations={a:{x:620,y:260},b:{x:690,y:105},c:{x:680,y:420},d:{x:790,y:170},e:{x:790,y:350}};
 const opts={slot:0,id:'f',star:'a',attackers:ids,defenders:def,at:id=>locations[id],anchor:{x:.73,y:.5},W,H,settled:true,shooter:'b',contest:'g',shotType:'mid'};
 const target=scheme=>m.tacticalDefenseTarget({...opts,scheme,assigned:m.tacticalAssignments(scheme,ids,def,'a','b','g')});
 assert.ok(target('Protect the Paint').x>.8*W);assert.ok(target('Perimeter Secured').x<.75*W);
 assert.equal(target('Man-to-Man').x,668);assert.notEqual(target('Double the Star').y,260);
 assert.equal(m.screenTarget({x:120,y:260},0,W,H),null);
 const screen=m.screenTarget(locations.a,0,W,H);assert.ok(Math.hypot(screen.x-locations.a.x,screen.y-locations.a.y)<65);
 const app=read('public/app.js');assert.match(app,/motion\.tacticalDefenseTarget/);assert.match(app,/event\.screenSetterId===id/);assert.match(app,/motion\.screenTarget/);
});

test('actual animation brings the selected screen setter near the handler even for a tired slow player',()=>{
 const app=read('public/app.js'),end='        canvasPositions.set(id,prev);';
 const source=app.slice(app.indexOf('  function drawCourt(ms){'),app.indexOf(end)+end.length)+'\n}}\n}';
 for(const mode of ['Pure Chaos','Run & Gun','Old-School Buckets','Play Through Point'])for(const attackRight of [true,false]){
  const active=[ids,def],lead=1850,toScreen=x=>attackRight?x:W-x;let clock=0;
  const event={id:1,at:0,offense:0,attackRight,shooter:'a',defender:'f',type:'mid',displayEvent:'mid',made:true,shotDistanceFt:17,passes:[],passDurationMs:0,jumperSetupMs:230,screen:true,screenSetterId:'e',screenHandlerId:'a',transition:{kind:'inbound',reason:'basket',sourceId:'d',inbounderId:'d',receiverId:'a',handlerId:'a',durationMs:lead},pointPG:'a',pointCenter:'e',pointRoutes:{a:{x:.69,y:.5},e:{x:.83,y:.53}},arcShooters:['a','b'],arcShooter:'a',oldRebounder:'d',screeners:['c','d','e']};
  const state={code:'TEST',gameNumber:1,phase:'sim',game:{active,offense:0,quarter:1,event},teams:active.map((five,i)=>({offense:i===0?mode:'Team Ball',defense:'Man-to-Man',energy:Object.fromEntries(five.map(id=>[id,0]))}))};
  const positions=new Map(active.flatMap(five=>five.map((id,i)=>[id,{x:toScreen(100+i*15),y:80+i*80}])));
  const env={state,canvasPositions:positions,lastMotionFrame:null,transitionKey:'',transitionStarts:new Map(),transitionBallStart:null,previousBall:null,frameRunning:true,syncOffset:0,Date:{now:()=>clock},performance:{now:()=>clock},$:()=>({getContext:()=>({clearRect(){}})}),window:{CourtMotion:m,CourtDesigns:{drawCourt(){}}},player:id=>({name:id,overall:80,stats:{speed:35,dribbling:65}}),ANKLE_BANNER_MS:1900,POSTER_REACTIONS_MS:1900,ANKLE_STUMBLE_MS:1050};
  runInNewContext(source,env);
  let min=Infinity;for(clock=0;clock<lead+300;clock+=1000/60){env.drawCourt(clock);if(clock>=lead-1200){const a=positions.get('a'),b=positions.get('e');min=Math.min(min,Math.hypot(a.x-b.x,a.y-b.y));}}
  assert.ok(min<=85,mode+' '+attackRight+' '+min);
 }
});
