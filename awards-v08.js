// COURT CASH v0.8 — awards are authoritative game results, never client guesses.
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
const n=(s,k)=>Number(s?.[k])||0;
export const mvpScore=s=>n(s,'pts')+n(s,'ast')+n(s,'reb')-n(s,'tov');
export const dpogScore=s=>n(s,'blk')+n(s,'stl');
export function teamTotals(team,stats){
  const keys=['pts','reb','ast','stl','blk','tov','fgm','fga','threeM','threeA','ftm','fta','pf'];
  return Object.fromEntries(keys.map(key=>[key,team.roster.reduce((sum,id)=>sum+n(stats[id],key),0)]));
}
export function gradeTeams(teams,stats){
  const totals=teams.map(t=>teamTotals(t,stats));
  const grades=totals.map((t,i)=>({
    offense:clamp(Math.round(28+t.pts*.15+t.ast*.9+(t.fga?t.fgm/t.fga:0)*27-t.tov*.65)),
    defense:clamp(Math.round(62+t.stl*2.5+t.blk*2.0+t.reb*.18-totals[1-i].pts*.18-t.pf*.4))
  }));
  return {totals,grades};
}
export function gameAwards(teams,stats,winner){
  if(!Array.isArray(teams)||!teams[winner]||!stats)return null;
  const winningIds=teams[winner].roster;
  const allIds=teams.flatMap(t=>t.roster);
  const rank=(ids,score,tieKey)=>ids.slice().sort((a,b)=>score(stats[b])-score(stats[a])||
    n(stats[b],tieKey)-n(stats[a],tieKey)||a.localeCompare(b));
  const mvp=rank(winningIds,mvpScore,'pts')[0]||null;
  const dpog=rank(allIds,dpogScore,'stl')[0]||null;
  const {totals,grades}=gradeTeams(teams,stats);
  const top3=Object.entries({PTS:n(stats[mvp],'pts'),REB:n(stats[mvp],'reb'),AST:n(stats[mvp],'ast'),STL:n(stats[mvp],'stl'),BLK:n(stats[mvp],'blk')})
    .sort((a,b)=>b[1]-a[1]||['PTS','REB','AST','STL','BLK'].indexOf(a[0])-['PTS','REB','AST','STL','BLK'].indexOf(b[0]))
    .slice(0,3).map(([label,value])=>({label,value}));
  return {mvp,mvpScore:mvpScore(stats[mvp]),mvpTop3:top3,dpog,dpogScore:dpogScore(stats[dpog]),
    dpogSteals:n(stats[dpog],'stl'),dpogBlocks:n(stats[dpog],'blk'),totals,grades};
}
