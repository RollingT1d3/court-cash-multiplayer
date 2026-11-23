// COURT CASH v0.6 strategy mechanics. All percentages apply PER POSSESSION
// (not per animation frame), except stamina drain multipliers.
export const RUN_FOR_THE_HILLS='Run For The Hills';
export const FULL_COURT_PRESS='Full Court Press';
export const HILLS_SPEED_MULTIPLIER=1.07;  // +7% movement speed
export const HILLS_STAMINA_MULTIPLIER=1.14; // 14% faster fatigue on this offense
export const PRESS_DEFENSE_STAMINA_MULTIPLIER=1.75; // 75% faster fatigue for pressing team
export const PRESS_OFFENSE_STAMINA_MULTIPLIER=1.16; // 16% faster fatigue for press victims
export const PRESS_STEAL_BONUS=.008; // +0.8 percentage points to on-ball attempts
export const EIGHT_SECOND_VIOLATION_CHANCE=.10;
export const HILLS_OFFENSIVE_REBOUND_BONUS=.08; // +8 percentage points on crash; +4 on kickouts
export const HILLS_PUTBACK_CHANCE=.50; // 50% of offensive paint-crash rebounds immediately attempt a putback
export const PRESS_DEFENSE_ANCHORS=Object.freeze([
  Object.freeze({x:.32,y:.50}),Object.freeze({x:.41,y:.22}),Object.freeze({x:.42,y:.78}),
  Object.freeze({x:.55,y:.37}),Object.freeze({x:.55,y:.64})
]);

// PG is always active[0]. A better passer standing in another role is the
// inbounder even when the player occupying the PG slot can pass well.
export function hillsInbounder(active,stat){
  if(!Array.isArray(active)||active.length!==5)throw Error('Five active players required');
  return active.slice(1).sort((a,b)=>stat(b,'passing')-stat(a,'passing'))[0];
}

// No zone/half-court static formations: four runners mix up lanes every play.
export function hillsRoutes(active,inbounder,stat,random=Math.random){
  const runners=active.filter(id=>id!==inbounder);
  const ranked=runners.slice().sort((a,b)=>
    Math.max(stat(b,'three'),stat(b,'mid'))-Math.max(stat(a,'three'),stat(a,'mid')) ||
    (stat(b,'three')+stat(b,'mid'))-(stat(a,'three')+stat(a,'mid')));
  const shooters=ranked.slice(0,2);
  const paintPlayers=ranked.slice(2);
  const lanes=[.22,.38,.62,.78];
  // Fisher-Yates preserves uniform random lane assignments.
  for(let i=lanes.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
  const wantsKickout=random()<.5;
  // Not every kickout finds a shooter: failed kickouts finish at the rim.
  const kickoutCaught=wantsKickout&&random()<.67;
  const targetShooter=kickoutCaught?shooters[Math.floor(random()*shooters.length)]:null;
  const shooter=targetShooter||paintPlayers[Math.floor(random()*paintPlayers.length)];
  const perimeterShot=Boolean(targetShooter);
  const targets=Object.fromEntries(runners.map((id,i)=>[id,{
    x:wantsKickout&&shooters.includes(id)?.65+random()*.055:.83+random()*.055,
    y:lanes[i]
  }]));
  return {inbounder,shooters,paintPlayers,runners,targets,paintCrash:!wantsKickout,
    wantsKickout,kickoutCaught,perimeterShot,shooter};
}
export function pressForcesEightSeconds(random=Math.random){return random()<EIGHT_SECOND_VIOLATION_CHANCE;}
export function pressOnBallChance(ordinaryChance,isPress){return Math.min(1,Math.max(0,ordinaryChance)+(isPress?PRESS_STEAL_BONUS:0));}
export function hillsOffensiveReboundChance(baseChance,perimeterShot){
  return Math.min(.95,Math.max(0,baseChance)+HILLS_OFFENSIVE_REBOUND_BONUS*(perimeterShot?.5:1));
}
export function pickHillsPutback(random=Math.random){return random()<HILLS_PUTBACK_CHANCE;}
