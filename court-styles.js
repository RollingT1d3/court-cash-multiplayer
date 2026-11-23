// COURT CASH — four equally likely looks. Server chooses once per game.
export const COURT_STYLES = Object.freeze([
  'midnight-stars',
  'dark-brown',
  'blue-sky',
  'whiteout'
]);

export function chooseCourtStyle(random = Math.random) {
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('Court-style random value must be in [0, 1).');
  }
  return COURT_STYLES[Math.floor(roll * COURT_STYLES.length)];
}
