// Court Cash shooting-foul rules. Percentages are independent per defended shot attempt.
export function foulBonus(ft) {
  const score = Number(ft);
  if (score >= 100) return 0.05;
  if (score >= 90) return 0.03;
  if (score >= 86) return 0.02;
  if (score >= 80) return 0.01;
  return 0;
}
export function shootingFoulChance(shotType, freeThrowRating) {
  if (!['three','mid','layup','dunk'].includes(shotType)) throw Error('Unrecognized shot type.');
  return (['three','mid'].includes(shotType) ? 0.02 : 0.05) + foulBonus(freeThrowRating);
}
export function shootFreeThrows(freeThrowRating, attempts, random = Math.random) {
  const probability = Math.max(0,Math.min(1,Number(freeThrowRating)/100));
  let made = 0;
  for(let i=0;i<attempts;i++) if(random()<probability) made++;
  return {attempts,made};
}
export function eligibleBench(roster, active, disqualified) {
  return roster.filter(id => !active.includes(id) && !disqualified.includes(id));
}
