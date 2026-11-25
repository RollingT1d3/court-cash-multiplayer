// Four 10-minute quarters; each tied finish starts a three-minute OT.
export const REGULATION_QUARTER_SECONDS = 600;
export const OVERTIME_SECONDS = 180;

// Every overtime grants both teams +1 timeout.
export function advancePeriod(game,teams){
  if(game.secondsLeft>0)return 'playing';
  if(game.quarter<4){
    game.quarter++;
    game.secondsLeft=REGULATION_QUARTER_SECONDS;
    game.periodLength=REGULATION_QUARTER_SECONDS;
    game.period='Q'+game.quarter;
    return 'regulation';
  }
  if(game.score[0]!==game.score[1])return 'finished';
  game.quarter++;
  game.period='OT'+(game.quarter-4);
  game.secondsLeft=OVERTIME_SECONDS;
  game.periodLength=OVERTIME_SECONDS;
  for(const team of teams)team.timeouts++;
  return 'overtime';
}
