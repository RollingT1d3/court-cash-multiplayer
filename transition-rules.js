// Presentation-only possession starts. Never modify ratings, RNG or statistics.
export function possessionTransition(previous,offense,quarter,active,timeout,firstHandler,hillsInbounder){
  const handler=active.includes(firstHandler)?firstHandler:active[0];
  const quarterStart=previous&&previous.quarter!==undefined&&previous.quarter!==quarter;
  let kind='advance',reason='tip',sourceId=active[0];
  if(timeout){kind='inbound';reason='timeout';}
  else if(quarterStart){kind='inbound';reason='period';}
  else if(previous){
    const dead=['illegal-screen','pass-out-of-bounds','eight-second-violation'].includes(previous.displayEvent);
    if(dead||previous.made||previous.foul&&previous.freeThrowResults?.at(-1)){
      kind='inbound';reason=dead?'turnover':'basket';
    }else if(previous.reboundId&&active.includes(previous.reboundId)&&!previous.putbackAttempt){
      sourceId=previous.reboundId;reason='rebound';kind=previous.offense===offense?'reset':'advance';
    }else if(previous.stealId&&active.includes(previous.stealId)){
      sourceId=previous.stealId;reason='steal';
    }else if(previous.offense===offense){kind='reset';reason='retained';}
    else {reason='live-ball';}
  }
  const inbounderId=kind==='inbound'?(active.includes(hillsInbounder)?hillsInbounder:active.find(id=>id!==handler&&id===active[4])||active.find(id=>id!==handler)):null;
  const receiverId=kind==='inbound'?(handler!==inbounderId?handler:active.find(id=>id!==inbounderId)):sourceId;
  return {kind,reason,handlerId:handler,inbounderId,receiverId,sourceId:kind==='inbound'?inbounderId:sourceId,durationMs:kind==='inbound'?1850:kind==='reset'?500:1450};
}
// Timeout requests are only legal after the displayed, precomputed play resolves.
export const TIMEOUT_DECISION_MS=1400;
export function possessionResolvedMs(e){
  if(!e)return 0;
  const lead=e.transition?.durationMs||0,pass=Number(e.passDurationMs)||0;
  const setup=Number(e.fadeSetupMs)||Number(e.jumperSetupMs)||0,shot=pass+setup+470;
  if(['eight-second-violation','illegal-screen','pass-out-of-bounds','interception','steal'].includes(e.displayEvent))return lead+pass+200;
  if(e.foul)return lead+pass+setup+350+(e.freeThrowResults?.length||0)*850;
  const rebound=shot+(e.displayEvent==='block'?0:(e.rimBounces||1)*180)+260;
  return lead+(e.putbackAttempt?rebound+300+(e.putbackMade?0:180):e.reboundId?rebound:shot);
}
export function timeoutControl(game,play,base,finishing=false){
  if(!game||finishing)return null;
  const waitingForPlay=!!play?.readyForPossession;
  const e=waitingForPlay?null:game.event;
  const start=e?.at??play?.at??game.tipoff?.at??0;
  const opensAt=base<3000||waitingForPlay?start:start+(e?possessionResolvedMs(e):game.tipoff?1800:0);
  return {side:game.offense,opensAt,playAt:play?.at??0,gameEventId:game.event?.id??0,waitingForPlay};
}
export function possessionWindow(e,base){
  if(base<3000||!e)return base; // accelerated tests retain their original clocks
  const lead=e.transition?.durationMs||0,setup=Number(e.fadeSetupMs)||Number(e.jumperSetupMs)||0,shot=(Number(e.passDurationMs)||0)+setup+470;
  const rebound=shot+(e.displayEvent==='block'?0:(e.rimBounces||1)*180)+260;
  const end=e.foul?(Number(e.passDurationMs)||0)+setup+350+(e.freeThrowResults?.length||0)*850:
    e.putbackAttempt?rebound+300+750:e.reboundId?rebound+220:
    e.deepThree?shot+1250:shot+850;
  const reactions=Math.max(e.posterDunk?shot+1900:0,e.ankleBreaker?(Number(e.passDurationMs)||0)+1900:0);
  return Math.max(lead+Math.max(e.fastBreak&&e.fastBreak.mode!=='reset'?Math.min(base,1750):base,end+100,reactions+100),possessionResolvedMs(e)+TIMEOUT_DECISION_MS);
}
