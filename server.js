import http from 'node:http';
import { readFileSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS = JSON.parse(readFileSync(path.join(ROOT, 'data/players.json'), 'utf8'));
const BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
if (new Set(PLAYERS.map(p => p.id)).size !== PLAYERS.length || PLAYERS.length < 16) throw Error('Players need unique IDs; at least 16 required.');
const ROOMS = new Map();
const SLOTS = ['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
const OFFENSE = ['Play Through Superstar','Play Through Stars','Team Ball','Live By the 3, Die by the 3','Paint Mash'];
const DEFENSE = ['Man-to-Man','Double the Star','Protect the Paint','Perimeter Secured'];
const BASE_SECONDS = 48*60;
// Optional short durations for automated integration tests. Production defaults remain unchanged.
const COIN_MS = Math.max(20,Number(process.env.COIN_MS)||3200);
const SPIN_MS = Math.max(20,Number(process.env.SPIN_MS)||2600);
const SIM_MS = Math.max(10,Number(process.env.SIM_MS)||750);
const TICK_MS = Math.max(10,Number(process.env.TICK_MS)||150);
const now = () => Date.now();
const token = () => randomBytes(20).toString('hex');
const clamp = (n,a,b) => Math.min(b, Math.max(a,n));
const rnd = () => Math.random();
const choice = xs => xs[Math.floor(rnd()*xs.length)];
const rating = (id,key) => BY_ID.get(id)?.stats[key] ?? 75;
const sk = (id,keys) => keys.reduce((n,[key,w]) => n + rating(id,key)*w,0) / keys.reduce((n,[,w])=>n+w,0);
const safeName = s => String(s || '').trim().slice(0,28).replace(/[<>]/g,'') || 'Team';
const fmt = x => x === 7 ? 7 : 1;
const other = i => 1-i;
const isFilled = team => team.roster.length === 8;
const account = room => room.teams.every(t=>t && isFilled(t));
const auth = (code,key) => {
  const room = ROOMS.get(String(code||'').toUpperCase());
  if (!room) throw Error('Room not found.');
  const i = room.teams.findIndex(t=>t && t.token===key);
  if (i<0) throw Error('Not authorized for this room.');
  return {room,i};
};
const teamNew = (name,key) => ({name:safeName(name),token:key,budget:5000,roster:[],slots:Object.fromEntries(SLOTS.map(s=>[s,null])),offense:OFFENSE[0],defense:DEFENSE[0],ready:false,wins:0,timeouts:4,connected:false,disconnectedAt:null,energy:{}});
function create(name,format) {
  let code;
  do {code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();} while(ROOMS.has(code));
  const key=token();
  const room={code,format:fmt(format),phase:'lobby',teams:[teamNew(name,key),null],lastActive:now(),listeners:[new Set(),new Set()],coinWinner:null,coinAt:0,spinIndex:0,remaining:PLAYERS.map(p=>p.id),wheel:null,auction:null,pending:null,play:null,game:null,gameNumber:0,log:[],timeout:null,result:null};
  ROOMS.set(code,room);return {code,token:key,teamIndex:0};
}
function join(code,name){
  const room=ROOMS.get(String(code||'').toUpperCase());
  if(!room)throw Error('That room code does not exist.');
  if(room.teams[1])throw Error('Room is already full.');
  if(room.phase!=='lobby')throw Error('That match has already started.');
  const key=token();room.teams[1]=teamNew(name,key);
  room.phase='coinflip';room.coinWinner=randomInt(2);room.coinAt=now();room.lastActive=now();
  broadcast(room);
  return {code:room.code,token:key,teamIndex:1};
}
function publicState(room,i){
  const removeSecret=t=>t?({name:t.name,budget:t.budget,roster:t.roster,slots:t.slots,offense:t.offense,defense:t.defense,ready:t.ready,wins:t.wins,timeouts:t.timeouts,connected:t.connected,energy:t.energy}):null;
  return {you:i,code:room.code,format:room.format,phase:room.phase,teams:room.teams.map(removeSecret),coinWinner:room.coinWinner,coinAt:room.coinAt,spinIndex:room.spinIndex,remaining:room.remaining,players:PLAYERS,wheel:room.wheel,auction:room.auction,pending:room.pending,play:room.play,game:room.game,gameNumber:room.gameNumber,log:room.log.slice(-14),timeout:room.timeout,result:room.result,serverTime:now()};
}
function broadcast(room){room.lastActive=now();for(let i=0;i<2;i++)for(let res of room.listeners[i]){try{res.write(`data: ${JSON.stringify(publicState(room,i))}\n\n`);}catch{room.listeners[i].delete(res);}}}
function log(room,msg){room.log.push(msg);if(room.log.length>120)room.log.shift();}
function pickPlayer(room){
  const rem=room.remaining;const total=rem.reduce((n,id)=>n+Math.max(.000001,BY_ID.get(id).weight||1),0);
  let mark=rnd()*total;
  for(const id of rem){mark-=Math.max(.000001,BY_ID.get(id).weight||1);if(mark<=0)return id;}
  return rem.at(-1);
}
function startSpin(room){
  if(account(room))return finishDraft(room);
  if(room.remaining.length===0)throw Error('Not enough players in pool for eight per team.');
  room.phase='wheel';room.wheel={id:pickPlayer(room),until:now()+SPIN_MS,spinId:room.spinIndex+1};room.auction=null;room.pending=null;
  broadcast(room);
}
function startAuction(room){
  const id=room.wheel.id;const [a,b]=room.teams;
  const open=(room.coinWinner + room.spinIndex)%2;
  const available=room.teams.map(t=>!isFilled(t));
  let mode,chooser=null,recipient=null;
  if(!available[0]||!available[1]){mode='auto';recipient=available.indexOf(true);}
  else if(a.budget<100&&b.budget<100){mode='auto';recipient=open;}
  else if(a.budget<100||b.budget<100){mode='free';chooser=a.budget>=100?0:1;}
  else {mode='normal';}
  room.phase='auction';
  room.auction={playerId:id,mode,turn:mode==='normal'?open:chooser,highBidder:null,bid:0,opening:open,passed:false,deadline:now()+30000,recipient};
  if(mode==='auto'){award(room,recipient,0);return;}
  broadcast(room);
}
function award(room,winner,cents){
  const id=room.auction.playerId,t=room.teams[winner];
  if(!t||t.roster.length>=8||t.budget<cents)throw Error('Invalid roster or funds.');
  t.roster.push(id);t.budget-=cents;
  room.remaining=room.remaining.filter(x=>x!==id);
  room.spinIndex++;
  log(room,`${t.name} drafted ${BY_ID.get(id).name}${cents?' for $'+(cents/100).toFixed(2):' for free'}.`);
  room.pending={winner,playerId:id};room.auction=null;room.phase='placement';room.wheel=null;
  broadcast(room);
}
function assignSlot(t,id,slot){
  if(!SLOTS.includes(slot)||!t.roster.includes(id))throw Error('Invalid player/slot.');
  const current=Object.entries(t.slots).find(([,value])=>value===id)?.[0];
  const displaced=t.slots[slot];
  if(current)t.slots[current]=displaced||null;
  t.slots[slot]=id;
}
function fillSlots(t){
  const assigned=new Set(Object.values(t.slots));
  for(const id of t.roster)if(!assigned.has(id)){
    const free=SLOTS.find(s=>!t.slots[s]);if(free){t.slots[free]=id;assigned.add(id);}
  }
}
function finishDraft(room){
  room.phase='lineup';room.pending=null;room.auction=null;room.wheel=null;
  room.teams.forEach(t=>{fillSlots(t);t.ready=false;});
  log(room,'Draft complete. Set lineups and schemes.');broadcast(room);
}
function freshStats(){return {pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,fgm:0,fga:0,threeM:0,threeA:0,seconds:0};}
function startGame(room){
  room.gameNumber++;
  for(const t of room.teams){t.timeouts=4;t.ready=false;t.energy=Object.fromEntries(t.roster.map(id=>[id,100]));}
  const stats=Object.fromEntries(room.teams.flatMap(t=>t.roster.map(id=>[id,freshStats()])));
  room.game={score:[0,0],secondsLeft:720,quarter:1,periodLength:720,offense:randomInt(2),active:room.teams.map(t=>SLOTS.slice(0,5).map(s=>t.slots[s])),stats,possessions:0,event:null,startedAt:now(),period:'Q1'};
  room.phase='sim';room.play=null;room.log=[];room.timeout=null;
  log(room,`Game ${room.gameNumber} has tipped off!`);broadcast(room);
}
const getPlayer = id=>BY_ID.get(id);
const ov = (id) => getPlayer(id)?.overall||70;
function positionPenalty(id, position){
  const p=getPlayer(id);if(!p||p.positions.includes(position))return 0;
  const weights={
    PG:[['passing',.34],['dribbling',.31],['speed',.19],['perimeterDef',.10],['three',.06]],
    SG:[['three',.29],['mid',.20],['perimeterDef',.24],['dribbling',.17],['speed',.10]],
    SF:[['perimeterDef',.23],['speed',.15],['three',.15],['rebound',.20],['strength',.15],['dunk',.12]],
    PF:[['strength',.24],['rebound',.29],['paintDef',.20],['dunk',.16],['post',.11]],
    C:[['strength',.25],['paintDef',.23],['block',.19],['rebound',.25],['post',.08]]
  };
  const quality=sk(id,weights[position]);
  const undersized=(position==='C'&&p.heightInches<78?2:position==='PF'&&p.heightInches<75?2:0);
  return clamp(Math.round(1+(p.overall-quality)/9)+undersized,1,6);
}
function effectiveOnCourt(room,side,id,key){
  const pos=room.game.active[side].indexOf(id);
  const penalty=pos<0?0:positionPenalty(id,SLOTS[pos]);
  return Math.max(25,rating(id,key)-penalty);
}

function effective(id,t,defSkill){let val=defSkill;return val * (0.72+0.28*(t.energy[id]??100)/100);}
function weightedId(ids,fun){const weights=ids.map(id=>Math.max(.01,fun(id)));let r=rnd()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<ids.length;i++){r-=weights[i];if(r<=0)return ids[i];}return ids.at(-1);}
function automaticSubs(room){
  const g=room.game;
  for(let side=0;side<2;side++){
    const t=room.teams[side];
    const bench=t.roster.filter(id=>!g.active[side].includes(id));
    if(!bench.length)continue;
    const worst=g.active[side].reduce((a,b)=>t.energy[a]<t.energy[b]?a:b);
    const slot=g.active[side].indexOf(worst);const best=bench.reduce((a,b)=>((t.energy[a]??100)-positionPenalty(a,SLOTS[slot])*2)>((t.energy[b]??100)-positionPenalty(b,SLOTS[slot])*2)?a:b);
    if((t.energy[worst]??100)<58 && (t.energy[best]??100)>(t.energy[worst]??100)+14){
      const ix=g.active[side].indexOf(worst);
      g.active[side][ix]=best;
      log(room,`${getPlayer(best).name} checks in for ${getPlayer(worst).name}.`);
    }
  }
}
function fatigue(room,seconds){
  const g=room.game;
  for(let i=0;i<2;i++){
    const t=room.teams[i];
    for(const id of t.roster){
      if(g.active[i].includes(id)){
        const stamina=rating(id,'stamina');
        const drain=(.22+(100-stamina)*.034)*(seconds/17);
        t.energy[id]=clamp((t.energy[id]??100)-drain,0,100);
        g.stats[id].seconds+=seconds;
      }else t.energy[id]=clamp((t.energy[id]??100)+1.3*(seconds/17),0,100);
    }
  }
}
function simulatePlay(room){
  const g=room.game;if(!g)return;
  const offense=g.offense,def=other(offense),ot=room.teams[offense],dt=room.teams[def];
  const shooters=g.active[offense],defenders=g.active[def];
  const scheme=ot.offense,dscheme=dt.defense;
  const high=shooters.slice().sort((a,b)=>ov(b)-ov(a));
  const shooter=weightedId(shooters,id=> {
    if(scheme===OFFENSE[0])return id===high[0]?10:1;
    if(scheme===OFFENSE[1])return high.slice(0,2).includes(id)?6:1;
    if(scheme===OFFENSE[2])return Math.max(1,rating(id,'teamwork')/75);
    if(scheme===OFFENSE[3])return Math.max(1,rating(id,'three')/70);
    return Math.max(1,rating(id,'dunk')/75);
  });
  const defender=weightedId(defenders,id=>1+rating(id,'perimeterDef')/200);
  const defSteal=effective(defender,dt,effectiveOnCourt(room,def,defender,'steal'));
  let event='miss',made=false,points=0,assistId=null,reboundId=null,stealId=null,blockId=null;
  const isThree = rnd() < (scheme===OFFENSE[3]?.68:scheme===OFFENSE[4]?.12:.32);
  const inPaint = !isThree && rnd()<(scheme===OFFENSE[4]?.78:.56);
  const type=isThree?'three':inPaint?(rnd()<.38?'dunk':'layup'):'mid';
  const seconds=Math.min(g.secondsLeft,10+randomInt(20));
  fatigue(room,seconds);
  for(const id of shooters.concat(defenders)){} // fatigue already updates all ten players.
  if(rnd()<clamp(.017+(defSteal-70)*.0011,.01,.08)){
    stealId=defender;g.stats[defender].stl++;g.stats[shooter].tov++;event='steal';
  }else{
    let value=isThree?effectiveOnCourt(room,offense,shooter,'three'):inPaint?(.44*effectiveOnCourt(room,offense,shooter,'layup')+.46*effectiveOnCourt(room,offense,shooter,'dunk')+.1*effectiveOnCourt(room,offense,shooter,'post')):effectiveOnCourt(room,offense,shooter,'mid');
    value=effective(shooter,ot,value);
    const defensiveRating=inPaint?effectiveOnCourt(room,def,defender,'paintDef'):effectiveOnCourt(room,def,defender,'perimeterDef');
    let defenseBump=(defensiveRating-75)*.0018;
    if(dscheme===DEFENSE[2]&&inPaint) defenseBump+=.11;
    if(dscheme===DEFENSE[3]&&isThree) defenseBump+=.105;
    if(dscheme===DEFENSE[1] && shooter===high[0]) defenseBump+=.11;
    const base=isThree?.365:inPaint?.61:.43;
    let chance=clamp(base+(value-80)*.0075-defenseBump,.12,.83);
    const blocked=inPaint && rnd()<clamp(.028+(effectiveOnCourt(room,def,defender,'block')-75)*.0018+(dscheme===DEFENSE[2]?.025:0),.006,.14);
    g.stats[shooter].fga++;if(isThree)g.stats[shooter].threeA++;
    if(blocked){g.stats[defender].blk++;blockId=defender;event='block';}
    else if(rnd()<chance){made=true;points=isThree?3:2;g.score[offense]+=points;g.stats[shooter].pts+=points;g.stats[shooter].fgm++;if(isThree)g.stats[shooter].threeM++;event=type;
      if(rnd()< (scheme===OFFENSE[2]?.76:.57)){
        const passers=shooters.filter(x=>x!==shooter);
        if(passers.length){assistId=weightedId(passers,id=>rating(id,'passing'));g.stats[assistId].ast++;}
      }
    }else event='miss';
    if(!made){
      const rebTeam=rnd()<(inPaint?.74:.80)?def:offense;
      reboundId=weightedId(g.active[rebTeam],id=>effectiveOnCourt(room,rebTeam,id,'rebound')+effectiveOnCourt(room,rebTeam,id,'strength')*.16);
      g.stats[reboundId].reb++;
    }
  }
  const timeUsed=Math.min(seconds,g.secondsLeft);g.secondsLeft-=timeUsed;g.possessions++;
  const shooterName=getPlayer(shooter).name;
  if(event==='steal')log(room,`${getPlayer(defender).name} steals the ball from ${shooterName}!`);
  else if(event==='block')log(room,`${getPlayer(defender).name} blocks ${shooterName}!`);
  else if(made)log(room,`${shooterName} scores ${points} ${points===3?'from deep':'points'}!${assistId?' Assisted by '+getPlayer(assistId).name+'.':''}`);
  else log(room,`${shooterName} misses${isThree?' a three':''}.${reboundId?' '+getPlayer(reboundId).name+' grabs the rebound.':''}`);
  g.event={id:g.possessions,type,displayEvent:event,offense,shooter,defender,assistId,reboundId,stealId,blockId,made,points,at:now()};
  automaticSubs(room);
  // Offensive rebounds keep possession; otherwise possession changes hands.
  g.offense=reboundId&&g.active[offense].includes(reboundId)?offense:other(offense);
  if(g.secondsLeft<=0){
    if(g.quarter<4){g.quarter++;g.secondsLeft=720;g.period='Q'+g.quarter;log(room,`Start of quarter ${g.quarter}.`);}
    else if(g.score[0]===g.score[1]){g.quarter++;g.period='OT'+(g.quarter-4);g.secondsLeft=300;log(room,'Overtime!');}
    else {completeGame(room);return;}
  }
  broadcast(room);
}
function completeGame(room){
  const g=room.game;const winner=g.score[0]>g.score[1]?0:1;room.teams[winner].wins++;
  room.result={winner,score:g.score.slice(),gameNumber:room.gameNumber,forfeit:false};
  log(room,`${room.teams[winner].name} wins Game ${room.gameNumber}, ${g.score[winner]}–${g.score[other(winner)]}!`);
  if(room.format===1 || room.teams[winner].wins===4)room.phase='finished';
  else {room.phase='intermission';room.teams.forEach(t=>t.ready=false);}
  broadcast(room);
}
function forfeit(room,i){if(room.phase==='finished')return;const winner=other(i);room.result={winner,forfeit:true,reason:`${room.teams[i].name} disconnected for over 30 seconds.`};room.phase='finished';log(room,room.result.reason);broadcast(room);}
function action(room,i,data){
  const t=room.teams[i],a=room.auction;
  switch(data.type){
    case 'bid':{
      if(room.phase!=='auction'||!a||a.mode!=='normal'||a.turn!==i)throw Error('Not your turn to bid.');
      const amount=Number(data.cents);
      if(!Number.isInteger(amount)||amount<100||amount%50!==0||amount<a.bid+50||amount>t.budget)throw Error('Bid must be a valid $0.50 increment within your budget.');
      a.bid=amount;a.highBidder=i;a.turn=other(i);a.deadline=now()+30000;a.passed=false;log(room,`${t.name} bids $${(amount/100).toFixed(2)}.`);broadcast(room);break;
    }
    case 'pass':{
      if(room.phase!=='auction'||!a||a.mode!=='normal'||a.turn!==i)throw Error('Not your turn to pass.');
      if(a.highBidder!==null){award(room,a.highBidder,a.bid);break;}
      if(a.passed){room.spinIndex++;log(room,'Both players passed. Spinning again.');startSpin(room);break;}
      a.passed=true;a.turn=other(i);a.deadline=now()+30000;broadcast(room);break;
    }
    case 'select':case 'freePass':{
      if(room.phase!=='auction'||!a||a.mode!=='free'||a.turn!==i)throw Error('Only the free-pick chooser can choose.');
      award(room,data.type==='select'?i:other(i),0);break;
    }
    case 'place':{
      if(!['placement','lineup','timeout'].includes(room.phase))throw Error('Lineup changes are not allowed now.');
      if(room.phase==='placement' && room.pending?.winner!==i)throw Error('Wait for the drafting team to place their player.');
      if(room.phase==='timeout' && room.timeout?.caller!==i)throw Error('Only the timeout caller can substitute.');
      const id=String(data.playerId),slot=String(data.slot);
      if(room.phase==='timeout'){
        const g=room.game;
        if(!t.roster.includes(id) || !SLOTS.includes(slot))throw Error('Invalid lineup change.');
        const slotIdx=SLOTS.indexOf(slot);
        // In timeout, slots PG–C represent active floor positions, bench slots represent inactive players.
        const onCourt=[...g.active[i]];
        const bench=t.roster.filter(pid=>!onCourt.includes(pid));
        const slotPlayers=onCourt.concat(bench);
        const previousIdx=slotPlayers.indexOf(id);
        if(previousIdx<0)throw Error('Player unavailable.');
        const old=slotPlayers[slotIdx];slotPlayers[slotIdx]=id;slotPlayers[previousIdx]=old;
        g.active[i]=slotPlayers.slice(0,5);
        broadcast(room);break;
      }
      assignSlot(t,id,slot);broadcast(room);break;
    }
    case 'next':{
      if(room.phase!=='placement'||room.pending?.winner!==i)throw Error('Only the winner may continue the draft.');
      fillSlots(t);room.pending=null;
      if(account(room))finishDraft(room);else startSpin(room);
      break;
    }
    case 'scheme':{
      if(!['lineup','intermission','timeout'].includes(room.phase))throw Error('Schemes can only change during preparation or timeouts.');
      if(data.offense!==undefined){if(!OFFENSE.includes(data.offense))throw Error('Unknown offense.');t.offense=data.offense;}
      if(data.defense!==undefined){if(!DEFENSE.includes(data.defense))throw Error('Unknown defense.');t.defense=data.defense;}
      broadcast(room);break;
    }
    case 'ready':{
      if(!['lineup','intermission'].includes(room.phase))throw Error('Not preparing for a game.');
      fillSlots(t);if(SLOTS.some(s=>!t.slots[s]))throw Error('Place all eight players first.');
      t.ready=true;
      if(room.teams.every(x=>x.ready))startGame(room);else broadcast(room);break;
    }
    case 'timeout':{
      if(room.phase!=='sim'||t.timeouts<1)throw Error('No timeouts available.');
      t.timeouts--;room.phase='timeout';room.timeout={caller:i,until:now()+30000};
      log(room,`${t.name} calls timeout. Both teams may adjust schemes; only ${t.name} may substitute.`);broadcast(room);break;
    }
    case 'resume':{
      if(room.phase!=='timeout'||room.timeout.caller!==i)throw Error('Only the caller can resume early.');
      room.phase='sim';room.timeout=null;broadcast(room);break;
    }
    default:throw Error('Unknown action.');
  }
}
// The server owns auction clocks, random picks, score, and roster state. Browsers only render states and request legal actions.
let lastSimulationAt=now(),lastBroadcastAt=now();
setInterval(()=>{
  const ms=now();
  for(const room of ROOMS.values()){
    if(ms-room.lastActive>4*60*60*1000){ROOMS.delete(room.code);continue;}
    if(room.phase==='coinflip'&&ms>=room.coinAt+COIN_MS)startSpin(room);
    if(room.phase==='wheel' && ms>=room.wheel.until)startAuction(room);
    if(room.phase==='auction'&&ms>=room.auction.deadline){
      const a=room.auction;
      if(a.mode==='free')award(room,other(a.turn),0);
      else if(a.mode==='normal'){
        if(a.highBidder!==null)award(room,a.highBidder,a.bid);
        else if(a.passed){room.spinIndex++;startSpin(room);}
        else {a.passed=true;a.turn=other(a.turn);a.deadline=ms+30000;broadcast(room);}
      }
    }
    if(room.phase==='timeout'&&ms>=room.timeout.until){
      room.phase='sim';room.timeout=null;broadcast(room);
    }
    if(room.phase==='sim'&&ms-(room.play?.at||0)>=SIM_MS){
      room.play={at:ms};simulatePlay(room);
    }
    if(['auction','timeout','coinflip','wheel'].includes(room.phase)&&ms-lastBroadcastAt>=1000)broadcast(room);
    if(!['finished','lobby'].includes(room.phase)){
      for(let i=0;i<2;i++){
        const t=room.teams[i];if(t&&t.disconnectedAt && ms-t.disconnectedAt>30000 && room.teams[other(i)]?.connected){forfeit(room,i);break;}
      }
    }
  }
  if(ms-lastBroadcastAt>=1000)lastBroadcastAt=ms;
},TICK_MS);

const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function body(req){let chunks=[],total=0;for await(const part of req){total+=part.length;if(total>1e5)throw Error('Request too large.');chunks.push(part);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,rooms:ROOMS.size,players:PLAYERS.length});
    if(req.method==='POST'&&url.pathname==='/api/create'){const v=await body(req);return json(res,200,create(v.name,v.format));}
    if(req.method==='POST'&&url.pathname==='/api/join'){const v=await body(req);return json(res,200,join(v.code,v.name));}
    if(req.method==='POST'&&url.pathname==='/api/action'){
      const v=await body(req);const {room,i}=auth(v.code,v.token);action(room,i,v);return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&url.pathname==='/api/state'){const {room,i}=auth(url.searchParams.get('code'),url.searchParams.get('token'));return json(res,200,publicState(room,i));}
    if(req.method==='GET'&&url.pathname==='/events'){
      const {room,i}=auth(url.searchParams.get('code'),url.searchParams.get('token'));
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      room.listeners[i].add(res);room.teams[i].connected=true;room.teams[i].disconnectedAt=null;broadcast(room);
      const keep=setInterval(()=>{try{res.write(': heartbeat\n\n');}catch{}},13000);
      req.on('close',()=>{clearInterval(keep);room.listeners[i].delete(res);if(!room.listeners[i].size){room.teams[i].connected=false;room.teams[i].disconnectedAt=now();}broadcast(room);});return;
    }
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
    let name=url.pathname==='/'?'/index.html':url.pathname;
    let file=path.resolve(ROOT,'public', '.'+decodeURIComponent(name));
    const pub=path.resolve(ROOT,'public');
    if(file!==pub && !file.startsWith(pub+path.sep))return json(res,403,{error:'Forbidden.'});
    let stat;try{stat=statSync(file);}catch{return json(res,404,{error:'Not found.'});}
    if(!stat.isFile())return json(res,404,{error:'Not found.'});
    res.writeHead(200,{'Content-Type':contentTypes[path.extname(file)]||'application/octet-stream','Cache-Control':'public,max-age=60'});
    createReadStream(file).pipe(res);
  }catch(error){json(res,400,{error:error.message||'Unexpected error.'});}
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Court Cash running on http://localhost:${port}`));
