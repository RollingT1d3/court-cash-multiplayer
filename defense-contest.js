// Individual shot contest: deductions are absolute probability points.
// Both Paint and Perimeter Defense use the same approved rating brackets.
// Effective ratings include existing position and fatigue adjustments; round
// fractional ratings to the nearest whole number before choosing a bracket.
const BANDS = Object.freeze([[40,0.001],[49,0.004],[52,0.005],[53,0.007],[58,0.008],[59,0.0085],[64,0.009],[69,0.0099],[72,0.01],[74,0.02],[79,0.025],[84,0.03],[88,0.035],[89,0.04],[90,0.045],[92,0.049],[96,0.05],[98,0.055],[99,0.059],[100,0.06]].map(Object.freeze));
export function individualDefenseContest(rating){
  const r=Math.max(0,Math.min(100,Math.round(Number.isFinite(rating)?rating:0)));
  return BANDS.find(([upper])=>r<=upper)[1];
}
