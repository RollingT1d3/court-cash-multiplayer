/* Court Cash presentation-only animation timing and ball paths. */
(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const between=(a,b,t,lift=0)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)-lift*4*t*(1-t)});
 const SHOT_MS=470,BOUNCE_MS=180,REBOUND_MS=260,PUTBACK_MS=300,NET_MS=170,FT_START=350,FT_STEP=850,TIP_MS=1800;
 function shotEnd(e){return (Number(e.passDurationMs)||0)+SHOT_MS;}
 function bounces(e){return clamp(Number(e.rimBounces)||1,1,3);}
 function reboundEnd(e){return shotEnd(e)+(e.displayEvent==='block'?0:bounces(e)*BOUNCE_MS)+REBOUND_MS;}
 function putbackEnd(e){return reboundEnd(e)+PUTBACK_MS;}
 function rimBounce(goal,age,count,direction){
   const index=Math.min(count-1,Math.floor(Math.max(0,age)/BOUNCE_MS));
   const t=clamp((age-index*BOUNCE_MS)/BOUNCE_MS,0,1);
   return {x:goal.x+direction*(index%2?1:-1)*(15+index*4)*Math.sin(Math.PI*t),y:goal.y-(22-index*4)*Math.sin(Math.PI*t)};
 }
 function normalBall(e,age,shooter,rebounder,goal,direction){
   const start=Number(e.passDurationMs)||0,end=shotEnd(e);
   if(age<start)return shooter;
   if(age<end){
     const target=e.displayEvent==='block'?between(shooter,goal,.42):goal;
     return between(shooter,target,clamp((age-start)/SHOT_MS,0,1),e.displayEvent==='block'?24:65);
   }
   if(e.reboundId&&rebounder){
     const count=e.displayEvent==='block'?0:bounces(e);
     const bounceEnd=end+count*BOUNCE_MS;
     if(age<bounceEnd)return rimBounce(goal,age-end,count,direction);
     const origin=e.displayEvent==='block'?between(shooter,goal,.42):goal;
     if(age<reboundEnd(e))return between(origin,rebounder,clamp((age-bounceEnd)/REBOUND_MS,0,1),12);
     if(e.putbackAttempt){
       if(age<putbackEnd(e))return between(rebounder,goal,clamp((age-reboundEnd(e))/PUTBACK_MS,0,1),35);
       if(e.putbackMade)return {x:goal.x+direction*16*clamp((age-putbackEnd(e))/NET_MS,0,1),y:goal.y};
       return rimBounce(goal,Math.min(BOUNCE_MS,age-putbackEnd(e)),1,direction);
     }
     return {x:rebounder.x+direction*15,y:rebounder.y+12};
   }
   if(e.made)return {x:goal.x+direction*16*clamp((age-end)/NET_MS,0,1),y:goal.y};
   return goal;
 }
 function freeThrowFrame(results,age,shooter,goal,direction){
   if(!results.length)return null;
   const elapsed=Math.max(0,age-FT_START),index=Math.min(results.length-1,Math.floor(elapsed/FT_STEP));
   const t=clamp(elapsed-index*FT_STEP,0,FT_STEP),made=results[index],release=120,arrival=550;
   let ball=shooter;
   if(t>=release&&t<arrival)ball=between(shooter,goal,(t-release)/(arrival-release),60);
   else if(t>=arrival)ball=made?{x:goal.x+direction*16*clamp((t-arrival)/NET_MS,0,1),y:goal.y}:rimBounce(goal,Math.min(BOUNCE_MS,t-arrival),1,direction);
   return {index,made,revealed:t>=arrival,ball,complete:age>=FT_START+results.length*FT_STEP};
 }
 function tipFrame(age,W,H,winningTeam){
   const t=clamp(age/TIP_MS,0,1),rise=t<.57?Math.sin(Math.PI*t/.57):0;
   const direction=winningTeam===0?-1:1;
   const tap=clamp((t-.57)/.35,0,1);
   return {jump:rise*28,ball:{x:W/2+direction*75*tap,y:H/2-10-95*rise+22*tap},won:t>=.57};
 }
 function transitionPosition(tr,age,start,target,side,offense,slot,id,W,H,direction){
   const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
   const mirror=x=>direction===1?x:W-x;
   const inbound=tr.kind==='inbound',sideline=tr.reason==='timeout'||tr.reason==='period'||tr.reason==='turnover';
   const staging=id===tr.inbounderId?{x:mirror(sideline?.24*W:9),y:sideline?7:H/2}:id===tr.receiverId?{x:mirror(.19*W),y:H*.5}:null;
   if(inbound&&staging){
     if(age<320)return between(start,staging,ease(age/320));
     if(age<650)return staging;
     return between(staging,target,ease((age-650)/(tr.durationMs-650)));
   }
   const t=ease(age/tr.durationMs);
   const lane=tr.kind==='reset'?0:Math.sin(Math.PI*t)*(slot%2?1:-1)*Math.min(26,Math.abs(target.x-start.x)*.08);
   return {x:lerp(start.x,target.x,t),y:lerp(start.y,target.y,t)+lane};
 }
 function transitionBall(tr,age,positions,direction,lastBall){
   const get=id=>positions.get(id),from=get(tr.sourceId),receiver=get(tr.receiverId),handler=get(tr.handlerId);
   const hold=p=>p?{x:p.x+direction*15,y:p.y+12+Math.abs(Math.sin(age/105))*7}:null;
   if(!from)return hold(handler||receiver)||lastBall;
   if(tr.kind==='inbound'){
     if(age<320&&lastBall)return between(lastBall,from,clamp(age/320,0,1),6);
     if(age<320)return hold(from);
     if(age<650&&receiver)return between(hold(from),hold(receiver),clamp((age-320)/330,0,1),12);
   }
   const carrier=tr.kind==='inbound'?receiver:from;
   const exchange=tr.durationMs-240;
   if(carrier&&handler&&carrier!==handler&&age>=exchange)return between(hold(carrier),hold(handler),clamp((age-exchange)/240,0,1),10);
   return hold(carrier||handler||from);
 }
 function passFrame(e,age){
   if(!Array.isArray(e.passes)||!e.passes.length||age>=e.passDurationMs)return null;
   const pass=e.passes.find(p=>age<p.endMs+130)||e.passes.at(-1);
   return {pass,flying:age>=pass.startMs&&age<pass.endMs,progress:clamp((age-pass.startMs)/Math.max(1,pass.durationMs),0,1),received:age>=pass.endMs,final:pass===e.passes.at(-1)};
 }
 function passBall(frame,positions,W,H,direction){
   const p=frame.pass,point=q=>({x:(direction===1?q.x:1-q.x)*W,y:q.y*H});
   const from=positions.get(p.fromId)||point(p.from),to=positions.get(p.toId)||point(p.to);
   const target=p.outcome==='intercepted'?(positions.get(p.interceptorId)||point(p.interceptionAt)):p.outcome==='out-of-bounds'?{x:to.x,y:p.to.y>.5?H+18:-18}:to;
   if(!frame.received&&!frame.flying)return from;
   if(frame.flying)return between(from,target,frame.progress,8);
   return target;
 }
 root.CourtMotion=Object.freeze({passFrame,passBall,transitionPosition,transitionBall,SHOT_MS,BOUNCE_MS,REBOUND_MS,PUTBACK_MS,FT_START,FT_STEP,TIP_MS,shotEnd,bounces,reboundEnd,putbackEnd,rimBounce,normalBall,freeThrowFrame,tipFrame});
})(typeof window==='undefined'?globalThis:window);
