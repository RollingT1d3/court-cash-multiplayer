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
// v0.8.2: all offenses use listed 3PT rating to determine base accuracy.
// 59 follows the lowest bracket; the user-defined table skipped exactly 59.
export function threePointBaseChance(threeRating){
  const r=clamp(Math.round(Number(threeRating)||0),0,100);
  if(r<=59)return .15;
  if(r<=69)return .25;
  if(r<=75)return .30;
  if(r<=79)return .39;
  if(r===80)return .40;
  if(r<=85)return .45;
  if(r<=89)return .49;
  if(r===90)return .50;
  if(r<=92)return .55;
  if(r<=94)return .575;
  if(r<=98)return .58;
  if(r===99)return .585;
  return .59;
}

// Distance penalties (percentage-point deductions) interpolate between anchors.
// Rating defaults to the standard tier for backward compatibility.
export function longThreePenalty(distance,threeRating=80){
  const feet=Number(distance);
  if(!Number.isFinite(feet)||feet<36)return 0;
  const rating=clamp(Math.round(Number(threeRating)||0),0,100);
  const table=rating===100?
    [[36,0],[40,0],[45,.01],[50,.02],[55,.03],[60,.05],[62,.07]]:
    rating>=95?
    [[36,0],[40,.02],[45,.04],[50,.06],[55,.09],[60,.12],[62,.15]]:
    [[36,.05],[40,.10],[45,.15],[50,.20],[60,.30],[62,.35]];
  for(let i=1;i<table.length;i++){
    if(feet<=table[i][0]){
      const [a,pa]=table[i-1],[b,pb]=table[i];
      return Math.round((pa+(feet-a)/(b-a)*(pb-pa))*1000000)/1000000;
    }
  }
  return table[table.length-1][1];
}
export function isDeepThree(type,made,distance){
  return type==='three'&&made===true&&distance>=36;
}
