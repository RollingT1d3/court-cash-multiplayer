// Advance an expired period. Regulation has four 12-minute quarters;
// each tied finish starts a five-minute OT and grants both teams +1 timeout.
export function advancePeriod(game,teams){
  if(game.secondsLeft>0)return 'playing';
  if(game.quarter<4){
    game.quarter++;
    game.secondsLeft=720;
    game.period='Q'+game.quarter;
    return 'regulation';
  }
  if(game.score[0]!==game.score[1])return 'finished';
  game.quarter++;
  game.period='OT'+(game.quarter-4);
  game.secondsLeft=300;
  for(const team of teams)team.timeouts++;
  return 'overtime';
}
