// v1.1 — individual shot tendencies, conditional on the existing offensive plan.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const anchors=[[50,.10],[65,.45],[75,1],[85,1.65],[95,2.50],[100,3]];
export function shotTendency(rating){
 const n=clamp(rating,0,100);
 if(n<50)return 0;
 for(let i=1;i<anchors.length;i++){
  const [a,x]=anchors[i-1],[b,y]=anchors[i];
  if(n<=b)return x+(y-x)*(n-a)/(b-a);
 }
 return 3;
}
export function dunkAttemptChance(dunk,layup){
 if(dunk<50&&layup>=50)return 0;
 if(layup<50&&dunk>=50)return 1;
 return clamp(.50+.012*(dunk-layup)+.004*(dunk-80),.02,.95);
}
// Strategic targets are unconditional three / conditional paint among non-threes.
// Protect the existing adhered-to primary shot share of deliberately specialized roles.
// Only redistribute the remaining share; flexible strategies have no reserved range.
export function shotRangeWeights({threeTarget,paintTarget,adherence,stats,protectedRange=null}){
 const t=clamp(.32+adherence*(threeTarget-.32),.05,.98);
 const p=clamp(.56+adherence*(paintTarget-.56),.07,.94);
 const plan={three:t,mid:(1-t)*(1-p),paint:(1-t)*p};
 const skill={three:stats.three,mid:stats.mid,paint:Math.max(stats.layup,stats.dunk)};
 const ranges=['three','mid','paint'];
 const reserve=protectedRange?plan[protectedRange]:0;
 const flexible=ranges.filter(k=>k!==protectedRange);
 const weights=Object.fromEntries(ranges.map(k=>[k,0]));
 if(protectedRange)weights[protectedRange]=reserve;
 let scaled=flexible.map(k=>plan[k]*shotTendency(skill[k]));
 let sum=scaled.reduce((a,b)=>a+b,0);
 if(sum===0){
  // If every flexible option is poor, keep the protected tactical range if usable.
  // Otherwise resolve to the highest-rated available scoring method (ties use plan).
  if(protectedRange&&skill[protectedRange]>=50){weights[protectedRange]=1;return weights;}
  const best=Math.max(...flexible.map(k=>skill[k]));
  if(protectedRange&&skill[protectedRange]>best){weights[protectedRange]=1;return weights;}
  scaled=flexible.map(k=>skill[k]===best?plan[k]:0);
  sum=scaled.reduce((a,b)=>a+b,0);
 }
 for(let i=0;i<flexible.length;i++)weights[flexible[i]]=(1-reserve)*scaled[i]/sum;
 return weights;
}
export function chooseShotRange(options,random=Math.random){
 const weights=shotRangeWeights(options);
 const r=random();let cumulative=0,last='paint';
 for(const k of ['three','mid','paint']){
  if(weights[k]<=0)continue;
  last=k;cumulative+=weights[k];if(r<cumulative)return k;
 }
 return last;
}
export function maxVoluntaryThreeDistance(rating){
 return rating>=95?62:rating>=90?46:rating>=85?40:rating>=80?35:29;
}
// The existing generator is retained: a rejected long-range roll becomes a
// normal attempt, rather than concentrating probability at the allowed maximum.
export function restrictThreeDistance(distance,rating,{desperation=false,random=Math.random}={}){
 if(desperation||distance<=maxVoluntaryThreeDistance(rating))return distance;
 const upper=Math.min(30,maxVoluntaryThreeDistance(rating));
 return 23+Math.floor(random()*(upper-23+1));
}
// The simulation does not track authoritative continuous ball coordinates.
// A new backcourt possession with <=3 seconds is the conservative heave proxy;
// a timeout or same-side retained possession is not a qualifying backcourt start.
export function desperationThreeAllowed({seconds,previous,offense,quarter,timeout=false}){
 return seconds>0&&seconds<=3&&!timeout&&!!previous&&previous.quarter===quarter&&previous.offense!==offense;
}
export function fadeTendency(rating){
 return rating<50?0:rating<60?.25:rating<70?.65:rating<80?1:rating<90?1.15:rating<95?1.30:1.50;
}
