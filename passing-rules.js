// Planned half-court passes, excluding inbound/transition handoffs.
// Percent distribution for 0,1,2,3,4,5 passes at high adherence.
export const PASS_DISTRIBUTIONS=Object.freeze({
 'Play Through Superstar':[42,39,14,4,1,0],
 'Play Through Stars':[24,40,24,9,3,0],
 'Team Ball':[8,22,31,24,12,3],
 'Live By the 3, Die by the 3':[15,32,30,16,6,1],
 'Paint Mash':[30,40,21,7,2,0],
 'Pure Chaos':[12,29,31,19,7,2],
 'Run & Gun':[10,30,32,19,8,1],
 'Old-School Buckets':[12,32,32,17,6,1],
 'Run For The Hills':[24,45,23,7,1,0],
 'Play Through Point':[24,38,25,10,3,0]
});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function passCount(scheme,adherence,seconds,random=Math.random,minimum=0){
 const weights=PASS_DISTRIBUTIONS[scheme]||PASS_DISTRIBUTIONS['Team Ball'];
 const cap=Math.max(0,Math.min(5,Math.floor((seconds-4)/3)));
 const discipline=clamp(adherence,0,1),baseline=[28,39,23,8,2,0];
 let r=random()*100,n=0;
 for(;n<5;n++){r-=weights[n]*discipline+baseline[n]*(1-discipline);if(r<0)break;}
 return Math.min(cap,Math.max(minimum,n));
}
// Increase optional passing involvement for active players who have gone without a touch.
// Retain each offensive strategy's preferred handlers and final passers.
export function touchPriority(possessionsSinceTouch=0){
 return 1+Math.min(10,Math.max(0,Number(possessionsSinceTouch)||0))*.30;
}
export function passPath(active,shooter,count,preferredFinal,preferredFirst,weight,random=Math.random){
 if(!count)return [shooter];
 const choose=ids=>{const w=ids.map(id=>Math.max(.01,weight(id))),sum=w.reduce((a,b)=>a+b,0);let r=random()*sum;for(let i=0;i<ids.length;i++){r-=w[i];if(r<0)return ids[i];}return ids.at(-1);};
 const path=[shooter];
 for(let i=0;i<count;i++){
  const next=path[0],candidates=active.filter(id=>id!==next);
  const preferred=i===count-1&&candidates.includes(preferredFirst)?preferredFirst:i===0?preferredFinal:null;
  const unused=candidates.filter(id=>!path.includes(id));
  path.unshift(candidates.includes(preferred)?preferred:choose(unused.length?unused:candidates));
 }
 return path;
}
// A failed pass ends the possession, with no later pass or shot.
export function resolvePassChain(path,resolve){
 const attempts=[];let elapsed=0;
 for(let i=0;i<path.length-1;i++){
  const pass=resolve(path[i],path[i+1]);
  const entry={...pass,fromId:path[i],toId:path[i+1],startMs:elapsed+100};
  entry.endMs=entry.startMs+entry.durationMs;
  attempts.push(entry);elapsed=entry.endMs+130;
  if(entry.outcome!=='complete')break;
 }
 return {attempts,durationMs:attempts.length?elapsed+180:0};
}

// v1.0: listed Passing rating grants additive percentage points on the
// receiver's immediate field-goal attempt, never on selection or pass odds.
export function passShotBonus(passing){
 if(!Number.isFinite(passing)||passing<79)return 0;
 if(passing>=100)return .10;
 if(passing>=99)return .075;
 if(passing>=98)return .05;
 if(passing>=95)return .045;
 if(passing>=91)return .04;
 if(passing>=90)return .035;
 if(passing>=89)return .03;
 if(passing>=88)return .025;
 if(passing>=86)return .02;
 if(passing>=85)return .015;
 if(passing>=80)return .01;
 return .005;
}
export function immediatePassShotBonus({passes=[],shooter,type,rating,ankleBreaker=false,postFade=false,fastBreak=null}){
 // The engine's normal final-pass reception goes directly into the shot.
 // Exclude distinct self-created moves and the outlet receiver's extra run.
 if(ankleBreaker||postFade||fastBreak?.mode==='outlet'||!['mid','three','fade','layup','dunk'].includes(type))return 0;
 const last=passes.at(-1);
 if(!last||last.outcome!=='complete'||last.toId!==shooter||last.fromId===shooter)return 0;
 return passShotBonus(rating(last.fromId,'passing'));
}
export function boostedShotChance(base,bonus){return clamp(base+bonus,0,1);}
