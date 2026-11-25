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
export function passPath(active,shooter,count,preferredFinal,preferredFirst,weight,random=Math.random){
 if(!count)return [shooter];
 const choose=ids=>{const w=ids.map(id=>Math.max(.01,weight(id))),sum=w.reduce((a,b)=>a+b,0);let r=random()*sum;for(let i=0;i<ids.length;i++){r-=w[i];if(r<0)return ids[i];}return ids.at(-1);};
 const path=[shooter];
 for(let i=0;i<count;i++){
  const next=path[0],candidates=active.filter(id=>id!==next);
  const preferred=i===count-1&&preferredFirst!==next?preferredFirst:i===0?preferredFinal:null;
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
