// Court Cash v0.8.4 — energy influences shooting, finishing and defense
// with different maximum penalties. Playmaking remains unaffected.
const MAX_FATIGUE_PENALTY=Object.freeze({
  shooting:.18,
  finishing:.12,
  defense:.10
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function fatigueMultiplier(category,energy=100){
  const penalty=MAX_FATIGUE_PENALTY[category]??0;
  const normalized=clamp(Number(energy) || 0,0,100)/100;
  return 1-penalty*(1-normalized);
}

export function fatiguedSkill(skill,energy,category){
  return skill*fatigueMultiplier(category,energy);
}

// Applied once when a timeout begins, to every active player on both teams.
export function timeoutRecovery(energy){
  return clamp((Number(energy) || 0)+4,0,100);
}
