// Court Cash v0.8.3 — modest height contests on jump shots and stronger
// height contests / block odds on interior shots.
// All values are additive probability points, not percentage multipliers.

function heightBand(inches) {
  const gap=Math.abs(inches);
  if(gap<=2)return 0;
  if(gap<=5)return 1;
  if(gap<=8)return 2;
  if(gap<=11)return 3;
  return 4;
}

// Positive means an easier shot for a taller shooter; negative means a harder
// shot against a taller defender. Equal-height matchups preserve old behavior.
export function heightContestAdjustment(shooterHeight,defenderHeight,shotType) {
  const gap=Number(shooterHeight)-Number(defenderHeight);
  if(!Number.isFinite(gap))return 0;
  const band=heightBand(gap);
  const interior=shotType==='layup'||shotType==='dunk';
  const table=interior?[0,.025,.045,.06,.08]:[0,.015,.03,.04,.05];
  return Math.sign(gap)*table[band];
}

// Only evaluated for layups/dunks. Positive means the defender is taller.
// Block skill still sets the core chance; the height effect caps at ±2 pp.
export function heightBlockAdjustment(shooterHeight,defenderHeight) {
  const gap=Number(defenderHeight)-Number(shooterHeight);
  if(!Number.isFinite(gap))return 0;
  return Math.sign(gap)*[0,.005,.01,.015,.02][heightBand(gap)];
}
