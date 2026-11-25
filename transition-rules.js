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
export function possessionWindow(e,base){
  if(base<3000||!e)return base; // accelerated tests retain their original clocks
  const lead=e.transition?.durationMs||0,shot=(Number(e.passDurationMs)||0)+470;
  const rebound=shot+(e.displayEvent==='block'?0:(e.rimBounces||1)*180)+260;
  const end=e.foul?(Number(e.passDurationMs)||0)+350+(e.freeThrowResults?.length||0)*850:
    e.putbackAttempt?rebound+300+750:e.reboundId?rebound+220:
    e.deepThree?shot+1250:shot+850;
  return lead+Math.max(e.fastBreak&&e.fastBreak.mode!=='reset'?Math.min(base,1750):base,end+100);
}
