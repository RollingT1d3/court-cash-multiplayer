// COURT CASH v0.4.1: opening tip-off depends ONLY on the two starting centers' heights.
// Values are probabilities for the taller center; for equal heights it is 50/50.
export function tallerTipoffChance(inchesApart) {
  if (!Number.isInteger(inchesApart) || inchesApart < 0) throw Error('Height difference must be a nonnegative integer number of inches.');
  if (inchesApart === 0) return .50;
  if (inchesApart <= 2) return .55;
  if (inchesApart === 3) return .65;
  if (inchesApart <= 5) return .80;
  if (inchesApart === 6) return .90;
  return .95;
}

export function determineTipoff(team0HeightInches, team1HeightInches, random = Math.random) {
  if (![team0HeightInches,team1HeightInches].every(h => Number.isInteger(h) && h > 0)) {
    throw Error('Both tip-off players need valid heights in inches.');
  }
  const heightDifference = Math.abs(team0HeightInches-team1HeightInches);
  const tallerChance = tallerTipoffChance(heightDifference);
  const favoredPercent = Math.round(tallerChance * 100);
  const team0Percent = team0HeightInches === team1HeightInches ? 50 :
    team0HeightInches > team1HeightInches ? favoredPercent : 100-favoredPercent;
  // Compute exact percentage brackets before conversion: avoids 0.05 vs 1-0.95 cutoff drift.
  const probabilityTeam0 = team0Percent / 100;
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw Error('Random tip-off value must be in [0,1).');
  return {
    winningTeam: roll < probabilityTeam0 ? 0 : 1,
    probabilities: [probabilityTeam0, (100-team0Percent)/100],
    heightDifference
  };
}
