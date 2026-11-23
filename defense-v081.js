// COURT CASH v0.8.1: two distinct zone configurations.
// The user chose the formations, but not exact numerical bonuses. Keep those
// balancing numbers together here so they can be tuned without touching gameplay.
export const FOUR_ONE_ZONE = '4-1 Zone';
export const TWO_TWO_ONE_ZONE = '2-2-1 Zone';

// All coordinates are normalized for an offense attacking the RIGHT basket.
// Four outside defenders (PG/SG/SF/PF), one inside safety (C).
export const FOUR_ONE_ANCHORS = Object.freeze([
  Object.freeze({x:.71,y:.17}), Object.freeze({x:.73,y:.38}),
  Object.freeze({x:.73,y:.62}), Object.freeze({x:.71,y:.83}),
  Object.freeze({x:.89,y:.50})
]);
// Pressing 2-2-1: two across the front, two around midcourt, one rim safety.
export const TWO_TWO_ONE_ANCHORS = Object.freeze([
  Object.freeze({x:.39,y:.29}), Object.freeze({x:.39,y:.71}),
  Object.freeze({x:.61,y:.30}), Object.freeze({x:.61,y:.70}),
  Object.freeze({x:.88,y:.50})
]);

export const FOUR_ONE_THREE_CONTEST = .09;
export const FOUR_ONE_MID_CONTEST = .04;
export const FOUR_ONE_PAINT_VULNERABILITY = .09;
export const FOUR_ONE_OFFENSIVE_REBOUND_BONUS = .04;
export const TWO_TWO_ONE_OPEN_LOOK_BONUS = .04;
export const TWO_TWO_ONE_LANE_INTERCEPTION_FACTOR = 1.30;
export const TWO_TWO_ONE_ONBALL_STEAL_BONUS = .004;
export const TWO_TWO_ONE_EIGHT_SECOND_CHANCE = .04;
export const TWO_TWO_ONE_DEFENDER_FATIGUE_FACTOR = 1.20;
export const TWO_TWO_ONE_ATTACKER_FATIGUE_FACTOR = 1.07;

export function zoneShotDefenseAdjustment(defense,shotType){
  if(defense===FOUR_ONE_ZONE){
    if(shotType==='three')return FOUR_ONE_THREE_CONTEST;
    if(shotType==='mid')return FOUR_ONE_MID_CONTEST;
    return -FOUR_ONE_PAINT_VULNERABILITY;
  }
  if(defense===TWO_TWO_ONE_ZONE)return -TWO_TWO_ONE_OPEN_LOOK_BONUS;
  return 0;
}
export function zoneDefendersForShot(defense,defenders,inPaint){
  if(defense===FOUR_ONE_ZONE)return inPaint?defenders.slice(4):defenders.slice(0,4);
  if(defense===TWO_TWO_ONE_ZONE)return inPaint?defenders.slice(4):defenders.slice(0,4);
  return defenders;
}
export function twoTwoOneEightSecond(random=Math.random){
  return random()<TWO_TWO_ONE_EIGHT_SECOND_CHANCE;
}
export function zoneLaneInterceptionChance(base,passing,defense){
  // Unbreakable v0.5 rule: 90+ Passing cannot be intercepted.
  if(passing>=90)return 0;
  if(defense!==TWO_TWO_ONE_ZONE)return base;
  return Math.min(1,Math.round(Math.max(0,base)*TWO_TWO_ONE_LANE_INTERCEPTION_FACTOR*10000)/10000);
}
export function zoneOnBallStealChance(base,defense){
  return Math.min(1,Math.max(0,base)+(defense===TWO_TWO_ONE_ZONE?TWO_TWO_ONE_ONBALL_STEAL_BONUS:0));
}
export function zoneAnchorOverrides(defense,defenders){
  const anchors=defense===FOUR_ONE_ZONE?FOUR_ONE_ANCHORS:
    defense===TWO_TWO_ONE_ZONE?TWO_TWO_ONE_ANCHORS:null;
  if(!anchors)return null;
  return Object.fromEntries(defenders.map((id,index)=>[id,anchors[index]]));
}
