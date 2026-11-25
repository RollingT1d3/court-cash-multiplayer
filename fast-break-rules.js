import {OFFENSE_ANCHORS,DEFENSE_ANCHORS} from './court-rules-v05.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot((a.x-b.x)*94,(a.y-b.y)*52.5);
const mirror=p=>({x:clamp(1-p.x,.04,.96),y:clamp(p.y,.06,.94)});
const feet={layup:4,dunk:4,mid:17,three:24};
const spot=(type,y=.5)=>({x:.926-feet[type]/94,y:type==='layup'||type==='dunk'?.5:y});
export function fastBreakPlan({previous,offense,quarter,seconds,active,defenders,rating,energy,timeout=false,random=Math.random}){
 if(timeout||!previous||previous.offense===offense||previous.quarter!==quarter||!['interception','steal'].includes(previous.displayEvent)||!active.includes(previous.stealId)||seconds<3)return null;
 const thief=previous.stealId;
 const oldAttack=previous.breakTargets||previous.pointRoutes||previous.hillsRoutes||{};
 const oldDefense=previous.breakDefense||previous.clogPositions||previous.zonePositions||{};
 const oldShot={x:clamp(.926-(previous.shotDistanceFt||15)/94,.14,.92),y:.5};
 const oldBall=previous.interceptionAt||previous.stealAt||oldAttack[previous.shooter]||oldShot;
 const origin=mirror(oldBall);
 const starts=Object.fromEntries(active.map((id,i)=>[id,id===thief?origin:mirror(oldDefense[id]||DEFENSE_ANCHORS[i])]));
 const guards=Object.fromEntries(defenders.map((id,i)=>[id,mirror(id===previous.shooter&&previous.displayEvent==='steal'?oldBall:oldAttack[id]||OFFENSE_ANCHORS[i])]));
 const stat=(id,k)=>clamp(rating(id,k),0,100);
 const motor=id=>.70+.30*clamp(energy(id)/100,0,1);
 const speed=(id,ball=false)=>(12+stat(id,'speed')*.16)*motor(id)*(ball?.67+stat(id,'dribbling')*.0025:1);
 const read=id=>(stat(id,'iq')*.45+stat(id,'teamwork')*.35+stat(id,'passing')*.20)/100;
 // Defenders have differing reaction times, not a guaranteed open lane.
 const reaction=Object.fromEntries(defenders.map(id=>[id,.10+(100-stat(id,'iq'))*.004+random()*.30]));
 const options=(id,from,available,withBall,extra=0)=>{
   const y=clamp(from.y,.23,.77);
   return ['layup','dunk','mid','three'].map(type=>{
     const target=spot(type,y),arrival=extra+dist(from,target)/speed(id,withBall);
     const recovery=defenders.map(d=>({id:d,time:reaction[d]+dist(guards[d],target)/speed(d)})).sort((a,b)=>a.time-b.time)[0];
     const gap=recovery.time-arrival;
     const skill=stat(id,type==='three'?'three':type==='mid'?'mid':type);
     const expected=type==='three'?3*clamp(.15+(skill-50)*.006,.08,.52):type==='mid'?2*clamp(.29+(skill-50)*.007,.10,.70):2*clamp(.40+(skill-50)*.008,.15,.88);
     // Favor the player's best genuine open shot, not automatically a dunk.
     const quality=expected+clamp(gap,-1,1)*.17+(stat(id,'iq')-75)*.001;
     return {id,type,target,arrival,gap,quality,defender:recovery.id,feet:feet[type],open:gap>.18&&arrival+.35<=available&&skill>=45};
   }).filter(o=>o.open).sort((a,b)=>b.quality-a.quality);
 };
 const available=Math.min(seconds,8);
 const own=options(thief,origin,available,true)[0];
 const lead=active.filter(id=>id!==thief).map(id=>{
   const start=starts[id],catchAt={x:clamp(Math.max(origin.x+.13,start.x+.18),.30,.64),y:clamp(start.y,.14,.86)};
   const catchTime=Math.max(.45,dist(start,catchAt)/speed(id),dist(origin,catchAt)/57)+.18;
   const candidate=options(id,catchAt,available,true,catchTime)[0];
   return candidate?{...candidate,catchAt,catchTime}:null;
 }).filter(Boolean).sort((a,b)=>b.quality-a.quality);
 const outlet=lead[0];
 // An outlet is most attractive when the steal is deep in the backcourt,
 // the receiver is ahead, or the interceptor is a poor transition scorer.
 const outletChance=clamp(.12+read(thief)*.58+(origin.x<.26?.13:0)+(own?clamp((outlet?.quality??0)-own.quality,-.25,.35):.18),.05,.94);
 let choice=null,mode='reset',from=null,to=null,leadMs=1450,afterMs=0;
 if(outlet&&(origin.x<.34||outlet.catchAt.x-origin.x>.20)&&(!own||outlet.quality>own.quality-.13)&&random()<outletChance){
   choice=outlet;mode='outlet';from=origin;to=outlet.catchAt;leadMs=360;afterMs=clamp(Math.round(dist(to,choice.target)*20),500,1450);
 }else if(own){
   choice=own;mode='solo';leadMs=clamp(Math.round(dist(origin,choice.target)*23),650,1900);
 }else{
   // If the carrier is cut off, look for a teammate who can reach a scoring
   // spot first. The pass happens after the advance, not at the steal spot.
   const cut={x:clamp(origin.x+.40,.45,.72),y:origin.y};
   const cutTime=dist(origin,cut)/speed(thief,true);
   const kick=active.filter(id=>id!==thief).flatMap(id=>options(id,starts[id],available,false,.12).map(o=>{
     const arrival=Math.max(o.arrival,cutTime+dist(cut,o.target)/57+.18);
     return {...o,arrival,gap:o.gap-(arrival-o.arrival)};
   }).filter(o=>o.arrival+.35<=available&&o.gap>.18)).sort((a,b)=>b.quality-a.quality)[0];
   if(kick&&cutTime+.5<available&&random()<clamp(.08+read(thief)*.82,.05,.90)){
     choice=kick;mode='kickout';from=cut;to=kick.target;leadMs=clamp(Math.round(cutTime*330),800,1700);afterMs=260;
   }
 }
 if(!choice)return {mode:'reset',thief,origin,starts,reason:'defense-recovered'};
 const target=choice.target;
 const targets=Object.fromEntries(active.map((id,i)=>[id,id===choice.id?target:id===thief&&from?from:{x:i%2?.69:.78,y:[.5,.18,.82,.32,.68][i]}]));
 const recoveryTargets=Object.fromEntries(defenders.map((id,i)=>[id,id===choice.defender?{x:clamp(target.x-.055-Math.min(.07,choice.gap*.04),.1,.95),y:clamp(target.y+.08,.08,.92)}:{x:.54+i*.045,y:[.5,.18,.82,.32,.68][i]}]));
 const passAt=mode==='outlet'?Math.max(.45,choice.catchTime||.5):mode==='kickout'?dist(origin,from)/speed(thief,true):0;
 const passDefense=Object.fromEntries(defenders.map(id=>{
   const start=guards[id],target=recoveryTargets[id],progress=clamp(Math.max(0,passAt-reaction[id])*speed(id)/Math.max(1,dist(start,target)),0,1);
   return [id,{x:start.x+(target.x-start.x)*progress,y:start.y+(target.y-start.y)*progress}];
 }));
 return {mode,thief,origin,starts,guards,passDefense,shooter:choice.id,defender:choice.defender,type:choice.type,feet:choice.feet,shotTarget:target,from,to,targets,recoveryTargets,leadMs,afterMs,seconds:Math.min(seconds,Math.max(3,Math.ceil(choice.arrival+.65))),gap:choice.gap,openBonus:clamp(.035+choice.gap*.05,.035,.105)};
}
