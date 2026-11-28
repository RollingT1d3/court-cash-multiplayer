// Basic: four 10-minute quarters. Advanced: four 12-minute quarters.
// Each tied finish starts a three-minute OT in either mode.
export const REGULATION_QUARTER_SECONDS = 600;
export const ADVANCED_REGULATION_QUARTER_SECONDS = 720;
export const OVERTIME_SECONDS = 180;
export const regulationQuarterSeconds = mode => mode==='advanced'?ADVANCED_REGULATION_QUARTER_SECONDS:REGULATION_QUARTER_SECONDS;

// Every overtime grants both teams +1 timeout.
export function advancePeriod(game,teams,mode='basic'){
  if(game.secondsLeft>0)return 'playing';
  if(game.quarter<4){
    game.quarter++;
    game.secondsLeft=regulationQuarterSeconds(mode);
    game.periodLength=game.secondsLeft;
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
