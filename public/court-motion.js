/* Court Cash presentation-only animation timing and ball paths. */
(function(root){
 'use strict';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const between=(a,b,t,lift=0)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)-lift*4*t*(1-t)});
 const SHOT_MS=470,BOUNCE_MS=180,REBOUND_MS=260,PUTBACK_MS=300,FT_START=350,FT_STEP=850,TIP_MS=1800;
 function shotSetup(e){return Number(e.fadeSetupMs)||Number(e.jumperSetupMs)||0;}
 function shotStart(e){return (Number(e.passDurationMs)||0)+shotSetup(e);}
 // Short, close-to-body shooting-pocket lift, mirrored by attack direction.
 // A full circle is reserved for fadeaways. Normal jumpers lift from the
 // lower shooting side to the upper shooting side (about 1:30 or 10:30).
 function jumperBall(shooter,age,duration,direction){
   const progress=clamp(age/Math.max(1,duration),0,1);
   const t=progress*progress*(3-2*progress);
   const angle=lerp(Math.atan2(12,16),-Math.PI/4,t),r=lerp(20,32,t);
   return {x:shooter.x+direction*r*Math.cos(angle),y:shooter.y+r*Math.sin(angle)};
 }
 function setupBall(e,shooter,age,direction){return e.fadeSetupMs?fadeBall(shooter,age,shotSetup(e),direction):jumperBall(shooter,age,shotSetup(e),direction);}
 function shotEnd(e){return shotStart(e)+SHOT_MS;}
 // The ball travels to twelve o'clock, makes one complete revolution around
 // the portrait, then releases from twelve o'clock. The circle follows the
 // moving player and reverses direction when attacking the other basket.
 function fadeBall(shooter,age,duration,direction){
   const r=37,approach=Math.min(100,duration*.20);
   const top={x:shooter.x,y:shooter.y-r};
   if(age<approach)return between(shooter,top,clamp(age/Math.max(1,approach),0,1));
   const angle=-Math.PI/2+direction*Math.PI*2*clamp((age-approach)/Math.max(1,duration-approach),0,1);
   return {x:shooter.x+r*Math.cos(angle),y:shooter.y+r*Math.sin(angle)};
 }
 function bounces(e){return clamp(Number(e.rimBounces)||1,1,3);}
 function reboundEnd(e){return shotEnd(e)+(e.displayEvent==='block'?0:bounces(e)*BOUNCE_MS)+REBOUND_MS;}
 function putbackEnd(e){return reboundEnd(e)+PUTBACK_MS;}
 function rimBounce(goal,age,count,direction){
   const index=Math.min(count-1,Math.floor(Math.max(0,age)/BOUNCE_MS));
   const t=clamp((age-index*BOUNCE_MS)/BOUNCE_MS,0,1);
   return {x:goal.x+direction*(index%2?1:-1)*(15+index*4)*Math.sin(Math.PI*t),y:goal.y-(22-index*4)*Math.sin(Math.PI*t)};
 }
 function normalBall(e,age,shooter,rebounder,goal,direction){
   const passEnd=Number(e.passDurationMs)||0,start=shotStart(e),end=shotEnd(e);
   const setup=shotSetup(e);
   if(age<passEnd)return shooter;
   if(setup&&age<start)return setupBall(e,shooter,age-passEnd,direction);
   const release=setup?setupBall(e,shooter,setup,direction):shooter;
   if(age<end){
     const target=e.displayEvent==='block'?between(release,goal,.42):goal;
     return between(release,target,clamp((age-start)/SHOT_MS,0,1),e.displayEvent==='block'?24:65);
   }
   if(e.reboundId&&rebounder){
     const count=e.displayEvent==='block'?0:bounces(e);
     const bounceEnd=end+count*BOUNCE_MS;
     if(age<bounceEnd)return rimBounce(goal,age-end,count,direction);
     const origin=e.displayEvent==='block'?between(release,goal,.42):goal;
     if(age<reboundEnd(e))return between(origin,rebounder,clamp((age-bounceEnd)/REBOUND_MS,0,1),12);
     if(e.putbackAttempt){
       if(age<putbackEnd(e))return between(rebounder,goal,clamp((age-reboundEnd(e))/PUTBACK_MS,0,1),35);
       if(e.putbackMade)return {...goal};
       return rimBounce(goal,Math.min(BOUNCE_MS,age-putbackEnd(e)),1,direction);
     }
     return {x:rebounder.x+direction*15,y:rebounder.y+12};
   }
   if(e.made)return {...goal};
   return goal;
 }
 function freeThrowFrame(results,age,shooter,goal,direction){
   if(!results.length)return null;
   const elapsed=Math.max(0,age-FT_START),index=Math.min(results.length-1,Math.floor(elapsed/FT_STEP));
   const t=clamp(elapsed-index*FT_STEP,0,FT_STEP),made=results[index],release=120,arrival=550;
   let ball=shooter;
   if(t>=release&&t<arrival)ball=between(shooter,goal,(t-release)/(arrival-release),60);
   else if(t>=arrival)ball=made?{...goal}:rimBounce(goal,Math.min(BOUNCE_MS,t-arrival),1,direction);
   return {index,made,revealed:t>=arrival,ball,complete:age>=FT_START+results.length*FT_STEP};
 }
 function tipFrame(age,W,H,winningTeam){
   const t=clamp(age/TIP_MS,0,1),rise=t<.57?Math.sin(Math.PI*t/.57):0;
   const direction=winningTeam===0?-1:1;
   const tap=clamp((t-.57)/.35,0,1);
   return {jump:rise*28,ball:{x:W/2+direction*75*tap,y:H/2-10-95*rise+22*tap},won:t>=.57};
 }
 // Same relative speed/energy/handle model as the server's fast-break planner.
 // Normalize against a fresh 75 Speed player moving without the ball.
 function movementFactor(stats={},energy=100,carrying=false,strategyBoost=1){
   const stat=(key,fallback)=>clamp(Number.isFinite(stats?.[key])?stats[key]:fallback,0,100);
   const stamina=.70+.30*clamp(Number.isFinite(energy)?energy:100,0,100)/100;
   const handle=carrying?.67+stat('dribbling',75)*.0025:1;
   return (12+stat('speed',75)*.16)/24*stamina*handle*strategyBoost;
 }
 // Time-based movement is independent of display refresh rate. A player
 // approaching a target eases into it without teleporting or overshooting.
 function movePlayer(start,target,elapsed,factor=1,tracking=false){
   const dt=clamp(Number(elapsed)||0,0,64);
   const dx=target.x-start.x,dy=target.y-start.y,distance=Math.hypot(dx,dy);
   if(!distance||!dt)return {...start};
   const maxSpeed=tracking?1100:720;
   const step=Math.min(distance,maxSpeed*factor*dt/1000,tracking?distance:distance*(1-Math.pow(.94,dt*factor/(1000/60))));
   return {x:start.x+dx/distance*step,y:start.y+dy/distance*step};
 }
 // Keep supporting attackers in the attacking half; canonical x increases toward the basket.
 function frontcourtSupportTarget(target,anchor,W){
   return target.x<.54*W?{x:anchor.x*W,y:target.y}:{...target};
 }
 // A trailing off-ball runner uses full movement speed until crossing midcourt,
 // rather than easing to a near stop while the possession changes around them.
 function moveSupportPlayer(start,target,elapsed,factor,W,direction){
   const behind=direction===1?start.x<W/2:start.x>W/2;
   return movePlayer(start,target,elapsed,factor,behind);
 }
 // A possession can end before a slow player's eased animation catches up.
 // Guarantee the frontcourt crossing by a presentation deadline, while still
 // allowing individual movement factors to advance faster than this minimum.
 // Work in canonical attacking coordinates so the rule mirrors at halftime.
 function advanceOffensiveMarker(previous,next,age,deadline,elapsed,W,direction){
   const dt=Math.max(0,Number(elapsed)||0);
   const toAttack=x=>direction===1?x:W-x;
   const from=toAttack(previous.x),desired=toAttack(next.x),line=.54*W;
   if(from>=line)return {...next,x:toAttack(Math.max(line,desired))};
   const remaining=Math.max(dt,deadline-age+dt);
   const fraction=age>=deadline?1:remaining>0?clamp(dt/remaining,0,1):0;
   const minimum=from+(line-from)*fraction;
   return {...next,x:toAttack(Math.max(desired,minimum))};
 }
 // Only the actual current ball carrier receives the dribbling modifier.
 function ballCarrier(e,rawAge,passFrame){
   if(!e)return null;
   const tr=e.transition,lead=tr?.durationMs||0,age=rawAge-lead;
   if(tr&&rawAge<lead){
     if(tr.kind==='inbound'){
       if(rawAge<320)return tr.sourceId;
       if(rawAge<650)return null;
     }
     const id=tr.kind==='inbound'?tr.receiverId:tr.sourceId;
     return id!==tr.handlerId&&rawAge>=lead-240?null:id;
   }
   if(passFrame){
     const p=passFrame.pass;
     if(passFrame.flying)return null;
     if(!passFrame.received)return p.fromId;
     return p.outcome==='complete'?p.toId:p.outcome==='intercepted'?p.interceptorId:null;
   }
   if(e.displayEvent==='steal')return e.stealId;
   if(e.passOutcome==='intercepted')return e.interceptorId;
   if(e.passOutcome==='out-of-bounds')return null;
   if(shotSetup(e)&&age>= (e.passDurationMs||0)&&age<shotStart(e))return e.shooter;
   if(e.foul)return null;
   if(e.reboundId&&!e.putbackAttempt&&age>=reboundEnd(e))return e.reboundId;
   return age<(e.passDurationMs||0)?e.shooter:null;
 }
 function transitionPosition(tr,age,start,target,side,offense,slot,id,W,H,direction,factor=1){
   const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
   const mirror=x=>direction===1?x:W-x;
   const inbound=tr.kind==='inbound',sideline=tr.reason==='timeout'||tr.reason==='period'||tr.reason==='turnover';
   const staging=id===tr.inbounderId?{x:mirror(sideline?.24*W:9),y:sideline?7:H/2}:id===tr.receiverId?{x:mirror(.19*W),y:H*.5}:null;
   if(inbound&&staging){
     if(age<320)return between(start,staging,ease(age/320));
     if(age<650)return staging;
     return between(staging,target,ease((age-650)*factor/Math.max(1,tr.durationMs-650)));
   }
   const t=ease(age*factor/Math.max(1,tr.durationMs));
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
 root.CourtMotion=Object.freeze({fadeBall,jumperBall,shotSetup,setupBall,shotStart,movementFactor,movePlayer,frontcourtSupportTarget,moveSupportPlayer,advanceOffensiveMarker,ballCarrier,passFrame,passBall,transitionPosition,transitionBall,SHOT_MS,BOUNCE_MS,REBOUND_MS,PUTBACK_MS,FT_START,FT_STEP,TIP_MS,shotEnd,bounces,reboundEnd,putbackEnd,rimBounce,normalBall,freeThrowFrame,tipFrame});
})(typeof window==='undefined'?globalThis:window);
