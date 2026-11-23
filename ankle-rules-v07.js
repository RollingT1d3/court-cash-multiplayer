// COURT CASH v0.7: raw, listed Dribbling vs raw, listed Perimeter Defense.
// Each eligible ball handler gets at most ONE attempt per simulated possession.
// All return values are probabilities in [0, 1] (not percent points).
const skill = n => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

export function ankleBreakerBase(dribbling) {
  const v = skill(dribbling);
  if (v < 80) return 0;
  if (v === 80) return .01;
  if (v <= 85) return .015;
  if (v <= 89) return .02;
  if (v === 90) return .03;
  if (v <= 94) return .04;
  if (v <= 98) return .045;
  if (v < 100) return .048;
  return .05;
}

export function ankleDefenseReduction(perimeterDefense) {
  const v = skill(perimeterDefense);
  if (v < 80) return 0;
  if (v === 80) return .005;
  if (v <= 85) return .01;
  if (v <= 89) return .02;
  if (v === 90) return .03;
  if (v <= 95) return .035;
  if (v <= 98) return .04;
  return Infinity; // 99/100 Perimeter Defense: CAN NEVER be broken.
}

export function ankleBreakerChance(dribbling, perimeterDefense) {
  const reduction = ankleDefenseReduction(perimeterDefense);
  if (reduction === Infinity) return 0;
  return Math.max(0, Math.round((ankleBreakerBase(dribbling) - reduction) * 10000) / 10000);
}

export function ankleBreaks(dribbling, perimeterDefense, random = Math.random) {
  const chance = ankleBreakerChance(dribbling, perimeterDefense);
  return chance > 0 && random() < chance;
}

// Defender stumbles off the assignment, briefly freeing the ball handler.
// This is an additive 12-percentage-point advantage to the immediate shot.
export const ANKLE_OPEN_SHOT_BONUS = .12;
// Animation durations are separate from possessions, expressed in ms.
export const ANKLE_STUMBLE_MS = 1050;
export const ANKLE_REACTIONS_MS = 1150;
export const POSTER_REACTIONS_MS = 1250;
