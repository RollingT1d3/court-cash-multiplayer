// COURT CASH v0.5: exact discrete basketball probabilities (0..1), not percentages.
// The tables below intentionally distinguish e.g. passing 80 from 81 and steals 99 from 100.
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const rating=n=>clamp(Number.isFinite(Number(n))?Number(n):0,0,100);

export function illegalScreenChance(iq){
  const n=rating(iq);
  if(n<=60)return .20;
  if(n<=70)return .15;
  if(n<=79)return .09;
  if(n<=89)return .05;
  return .01;
}
export function passingOutChance(passing){
  const n=rating(passing);
  if(n<=65)return .10;
  if(n<=70)return .08;
  if(n<=79)return .05;
  if(n<=80)return .01;
  return 0;
}
export function interceptionChance(steal,passing,isInLane){
  // A 90+ passer CANNOT be intercepted, even by a 100 Steal player in the lane.
  if(!isInLane||rating(passing)>=90)return 0;
  const n=rating(steal);
  if(n<80)return 0;
  if(n===80)return .02;
  if(n<=85)return .04;
  if(n<=89)return .05;
  if(n<=92)return .06;
  if(n<=98)return .07;
  if(n<100)return .08;
  return .10;
}
export function onBallStealBase(steal){
  const n=rating(steal);
  if(n<70)return 0;
  if(n===70)return .01;
  if(n<=75)return .015;
  if(n<=79)return .02;
  if(n<=84)return .03;
  if(n<=87)return .035;
  if(n<=89)return .04;
  if(n<=94)return .045;
  if(n<=98)return .05;
  if(n<100)return .055;
  return .07;
}
export function handleStealReduction(dribbling){
  const n=rating(dribbling);
  if(n<80)return 0;
  if(n===80)return .01;
  if(n<=84)return .015;
  if(n<=89)return .02;
  if(n<=94)return .025;
  if(n<=98)return .03;
  if(n<100)return .035;
  return .04;
}
export function onBallStealChance(steal,dribbling){
  return Math.max(0,Math.round((onBallStealBase(steal)-handleStealReduction(dribbling))*10000)/10000);
}
export function screenStrengthBonus(strength){
  // Successful, legal screens become incrementally more effective for strong setters.
  // A value of 100 adds 4 percentage points to shot success before final clamps.
  return clamp((rating(strength)-50)*.0008,0,.04);
}
export function passFlightMs(passing){
  // Higher Passing means a visibly faster flight, with no extra randomness.
  return Math.round(570-rating(passing)*4); // 0->570ms, 100->170ms
}

// Coordinates are canonical: the team on offense attacks the RIGHT-hand basket.
// These match the existing client-side player anchors (normalized 0..1).
export const OFFENSE_ANCHORS=Object.freeze([
  Object.freeze({x:.66,y:.50}),Object.freeze({x:.74,y:.20}),
  Object.freeze({x:.71,y:.82}),Object.freeze({x:.84,y:.33}),Object.freeze({x:.84,y:.64})
]);
export const DEFENSE_ANCHORS=Object.freeze([
  Object.freeze({x:.73,y:.50}),Object.freeze({x:.81,y:.20}),
  Object.freeze({x:.81,y:.82}),Object.freeze({x:.87,y:.38}),Object.freeze({x:.87,y:.65})
]);
import { PRESS_DEFENSE_ANCHORS } from './strategy-v06.js';
export const ZONE_ANCHORS=Object.freeze([
  Object.freeze({x:.72,y:.19}),Object.freeze({x:.74,y:.50}),
  Object.freeze({x:.72,y:.81}),Object.freeze({x:.86,y:.33}),Object.freeze({x:.86,y:.67})
]);
// Only defenders physically in the path between sender and receiver qualify.
// Normalized court coordinates use a scaled x-axis because the court is wide.
export function laneProximity(from,to,guard,radius=.078){
  if(!from||!to||!guard)return null;
  // scale x/y into actual pixels so the threshold represents screen-space distance.
  const dx=(to.x-from.x)*940,dy=(to.y-from.y)*525;
  const len2=dx*dx+dy*dy;
  if(len2<250)return null;
  const gx=(guard.x-from.x)*940,gy=(guard.y-from.y)*525;
  const t=(gx*dx+gy*dy)/len2;
  if(t<.08||t>.96)return null; // not beside the sender or far beyond the receiver
  const dist=Math.hypot(gx-t*dx,gy-t*dy);
  return dist<=radius*525?{distance:dist,progress:t}:null;
}
export function passingLaneDefenders(from,to,defenders,isZone=false,isPress=false){
  const anchors=isPress?PRESS_DEFENSE_ANCHORS:isZone?ZONE_ANCHORS:DEFENSE_ANCHORS;
  return defenders.map((id,i)=>({id,at:anchors[i],lane:laneProximity(from,to,anchors[i])}))
    .filter(x=>x.lane!==null).sort((a,b)=>a.lane.distance-b.lane.distance);
}
