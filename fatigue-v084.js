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

// Bench inspection: project the listed attributes through the same fatigue
// multipliers used by scoring and defense, without a position penalty.
// Post Moves is shown in its ordinary interior-finishing context; a post fade
// uses the existing shooting multiplier on its combined shot value instead.
// Free throws use listed FT directly; movement stamina is not a Speed rating change.
const DISPLAY_FATIGUE_CATEGORIES=Object.freeze({
  layup:'finishing',dunk:'finishing',post:'finishing',
  mid:'shooting',three:'shooting',fades:'shooting',
  paintDef:'defense',perimeterDef:'defense',block:'defense',steal:'defense'
});
export function fatigueAttributePreview(stats,energy=100){
  const values={};
  for(const [key,category] of Object.entries(DISPLAY_FATIGUE_CATEGORIES)){
    if(!Number.isFinite(stats?.[key]))continue;
    const base=stats[key],effective=fatiguedSkill(base,energy,category);
    if(effective<base)values[key]=effective;
  }
  return values;
}
