// COURT CASH v0.4 role selection and long-distance three-point logic.
// These pure helpers keep both offensive systems testable independently of live rooms.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const RUN_AND_GUN='Run & Gun';
export const OLD_SCHOOL_BUCKETS='Old-School Buckets';

export function offenseRoles(ids,stat){
  if(!Array.isArray(ids)||ids.length<3)throw Error('An offense needs at least three active players.');
  const threeRank=ids.slice().sort((a,b)=>stat(b,'three')-stat(a,'three') || stat(b,'mid')-stat(a,'mid'));
  const runShooters=threeRank.slice(0,2);
  // The top two shooters retain their specialized roles, even if one has a weak middie.
  // Of the other three players, the two weakest combined shooters screen/rebound only.
  const screenOnly=ids.filter(id=>!runShooters.includes(id))
    .sort((a,b)=>(stat(a,'three')+stat(a,'mid'))-(stat(b,'three')+stat(b,'mid'))).slice(0,2);
  const runThird=ids.find(id=>!runShooters.includes(id)&&!screenOnly.includes(id));
  const oldShooter=threeRank[0];
  // If the same player leads in shooting and rebounding, retain them at the arc and
  // position the next-best available rebounder inside to preserve both roles.
  const oldRebounder=ids.filter(id=>id!==oldShooter)
    .sort((a,b)=>stat(b,'rebound')-stat(a,'rebound'))[0];
  const oldCutters=ids.filter(id=>id!==oldShooter&&id!==oldRebounder);
  return {runShooters,screenOnly,runThird,oldShooter,oldRebounder,oldCutters};
}

// Half court is ~47 feet from the basket on a 94-foot floor.
// 36+ feet represents near-half-court, at-half-court and beyond-half-court threes.
export function threeDistanceFeet(threeRating,shotClockRemaining,random=Math.random){
  const desperation=shotClockRemaining<=5 ? .08 : 0;
  const deepAttemptOdds=clamp(.032+(threeRating-85)*.0008+desperation,.012,.17);
  if(random()<deepAttemptOdds)return 36+Math.floor(random()*27); // 36–62 ft
  return 23+Math.floor(random()*8); // ordinary 3-point attempts
}
export function longThreePenalty(distance){
  return distance>=36?clamp(.14+(distance-36)*.012,.14,.45):0;
}
export function isDeepThree(type,made,distance){
  return type==='three'&&made===true&&distance>=36;
}
