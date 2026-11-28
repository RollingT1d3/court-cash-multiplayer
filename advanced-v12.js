// V1.2 mode and resource rules. All mutations are server authoritative.
export const BASIC_SLOTS=['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
export const ADVANCED_SLOTS=[...BASIC_SLOTS,'Bench 3','Bench 4'];
export const TRADE_BUFFER_MS=3000,TRADE_DECISION_MS=30000;
export const modeRules=mode=>mode==='advanced'?{mode:'advanced',spins:18,cap:10,min:8,slots:ADVANCED_SLOTS,gatorades:2}:{mode:'basic',spins:16,cap:8,min:8,slots:BASIC_SLOTS,gatorades:0};
export function compactSlots(team){
 const keys=Object.keys(team.slots),owned=new Set(team.roster),seen=new Set();
 // Preserve surviving players' assigned positions wherever possible; fill holes
 // from the unassigned players and overflow bench slots.
 for(const [i,k] of keys.entries()){
  const id=team.slots[k];
  if(i<team.roster.length&&owned.has(id)&&!seen.has(id))seen.add(id);
  else team.slots[k]=null;
 }
 const unassigned=team.roster.filter(id=>!seen.has(id));
 for(const k of keys.slice(0,team.roster.length))if(!team.slots[k])team.slots[k]=unassigned.shift();
}
function checkTradePhase(room){if(room.mode!=='advanced'||room.phase!=='lineup'||room.gameNumber!==0)throw Error('Trades are only available before the first Advanced game.');}
function validateTrade(room,offer){
 const from=room.teams[offer.from],to=room.teams[1-offer.from];
 const validate=(t,a)=>{
  if(!Array.isArray(a.players)||new Set(a.players).size!==a.players.length||a.players.some(id=>!t.roster.includes(id)))throw Error('Invalid trade players.');
  if(!Number.isInteger(a.gatorades)||a.gatorades<0||a.gatorades>t.gatorades)throw Error('Invalid Gatorade amount.');
 };
 validate(from,offer.give);validate(to,offer.get);
 if(!offer.give.players.length&&!offer.get.players.length&&!offer.give.gatorades&&!offer.get.gatorades)throw Error('Choose something to trade.');
 const a=from.roster.length-offer.give.players.length+offer.get.players.length,b=to.roster.length-offer.get.players.length+offer.give.players.length;
 if(a<8||a>10||b<8||b>10)throw Error('Each team must retain 8–10 players.');
}
export function expireTrade(room,now){if(room.trade&&now>=room.trade.expiresAt){room.trade=null;room.tradeNotice='Trade offer expired.';return true;}return false;}
export function offerTrade(room,side,data,now,id){
 checkTradePhase(room);expireTrade(room,now);
 if(room.tradeUsed)throw Error('The one accepted trade has already been used.');
 if(room.trade)throw Error('A trade is already pending.');
 const asset=a=>({players:Array.isArray(a?.players)?a.players.slice():[],gatorades:a?.gatorades??0});
 const offer={id,from:side,give:asset(data.give),get:asset(data.get),acceptAt:now+TRADE_BUFFER_MS,expiresAt:now+TRADE_BUFFER_MS+TRADE_DECISION_MS};
 validateTrade(room,offer);
 room.trade=offer;room.tradeNotice='';room.teams.forEach(t=>t.ready=false);return offer;
}
export function answerTrade(room,side,data,now){
 checkTradePhase(room);
 if(expireTrade(room,now))throw Error('Trade offer expired.');
 const offer=room.trade;
 if(!offer||offer.id!==data.tradeId||side===offer.from)throw Error('Only the recipient can respond to this offer.');
 if(now<offer.acceptAt)throw Error('Wait for the three-second buffer.');
 if(data.accept!==true&&data.accept!==false)throw Error('Choose accept or decline.');
 if(!data.accept){room.trade=null;room.tradeNotice='Trade declined.';return false;}
 validateTrade(room,offer);
 const a=room.teams[offer.from],b=room.teams[1-offer.from],{give,get}=offer;
 a.roster=a.roster.filter(id=>!give.players.includes(id)).concat(get.players);
 b.roster=b.roster.filter(id=>!get.players.includes(id)).concat(give.players);
 a.gatorades+=get.gatorades-give.gatorades;b.gatorades+=give.gatorades-get.gatorades;
 for(const t of [a,b]){t.gatoradeAllocation=t.gatorades;compactSlots(t);t.ready=false;}
 room.tradeUsed=true;room.trade=null;room.tradeNotice='Trade accepted. Trading is now closed.';return true;
}
export function useGatorade(room,side,playerId,timeoutUntil,now){
 const t=room.teams[side];
 if(room.mode!=='advanced'||room.phase!=='timeout'||room.timeout?.caller!==side||room.timeout.until!==timeoutUntil||now>=room.timeout.until)throw Error('Gatorades can only be used during your own current timeout.');
 if(t.gatorades<1)throw Error('No Gatorades remaining.');
 if(!t.roster.includes(playerId)||room.game.fouledOut.includes(playerId))throw Error('Choose an eligible player on your team.');
 const energy=t.energy[playerId]??100;
 if(energy>=100)throw Error('This player already has full energy.');
 t.energy[playerId]=Math.min(100,energy+3);t.gatorades--;return t.energy[playerId];
}
