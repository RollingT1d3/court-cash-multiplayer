import http from 'node:http';
import { readFileSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';
import { shootingFoulChance, shootFreeThrows, eligibleBench } from './foul-rules.js';
import { offenseRoles, RUN_AND_GUN, OLD_SCHOOL_BUCKETS, threeDistanceFeet, longThreePenalty, isDeepThree } from './offense-v04.js';
import { determineTipoff } from './tipoff-v041.js';
import { chooseCourtStyle } from './court-styles.js';
import { illegalScreenChance, passingOutChance, interceptionChance, onBallStealChance, screenStrengthBonus, passFlightMs, OFFENSE_ANCHORS, passingLaneDefenders } from './court-rules-v05.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS = JSON.parse(readFileSync(path.join(ROOT, 'data/players.json'), 'utf8'));
const BUILD_VERSION = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
if (new Set(PLAYERS.map(p => p.id)).size !== PLAYERS.length || PLAYERS.length < 16) throw Error('Players need unique IDs; at least 16 required.');
const ROOMS = new Map();
const SLOTS = ['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
const OFFENSE = ['Play Through Superstar','Play Through Stars','Team Ball','Live By the 3, Die by the 3','Paint Mash','Pure Chaos',RUN_AND_GUN,OLD_SCHOOL_BUCKETS];
const DEFENSE = ['Man-to-Man','Double the Star','Protect the Paint','Perimeter Secured','3-2 Zone'];
const BASE_SECONDS = 48*60;
const TIMEOUTS_PER_GAME = 5;
// Optional short durations for automated integration tests. Production defaults remain unchanged.
const COIN_MS = Math.max(20,Number(process.env.COIN_MS)||3200);
const SPIN_MS = Math.max(20,Number(process.env.SPIN_MS)||2600);
// ~148 possessions at ~19.5 simulated seconds each; 3.25 seconds/play ≈ 8 real minutes per 48-minute game.
// Timeouts and overtime add real time. For automated tests SIM_MS may be overridden.
const SIM_MS = Math.max(10,Number(process.env.SIM_MS)||3250);
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
const teamNew = (name,key) => ({name:safeName(name),token:key,budget:5000,roster:[],slots:Object.fromEntries(SLOTS.map(s=>[s,null])),offense:OFFENSE[0],defense:DEFENSE[0],ready:false,wins:0,timeouts:TIMEOUTS_PER_GAME,connected:false,disconnectedAt:null,energy:{}});
function create(name,format) {
  let code;
  do {code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();} while(ROOMS.has(code));
  const key=token();
  const room={code,format:fmt(format),phase:'lobby',teams:[teamNew(name,key),null],lastActive:now(),listeners:[new Set(),new Set()],coinWinner:null,coinAt:0,spinIndex:0,remaining:PLAYERS.map(p=>p.id),wheel:null,auction:null,pending:null,play:null,game:null,gameNumber:0,log:[],timeout:null,foulout:null,result:null};
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
  return {you:i,code:room.code,format:room.format,phase:room.phase,teams:room.teams.map(removeSecret),coinWinner:room.coinWinner,coinAt:room.coinAt,spinIndex:room.spinIndex,remaining:room.remaining,players:PLAYERS,wheel:room.wheel,auction:room.auction,pending:room.pending,play:room.play,game:room.game,gameNumber:room.gameNumber,log:room.log.slice(-14),timeout:room.timeout,foulout:room.foulout,result:room.result,serverTime:now()};
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
function freshStats(){return {pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,fgm:0,fga:0,threeM:0,threeA:0,ftm:0,fta:0,pf:0,seconds:0};}
function startGame(room){
  room.gameNumber++;
  for(const t of room.teams){t.timeouts=TIMEOUTS_PER_GAME;t.ready=false;t.energy=Object.fromEntries(t.roster.map(id=>[id,100]));}
  const stats=Object.fromEntries(room.teams.flatMap(t=>t.roster.map(id=>[id,freshStats()])));
  const active=room.teams.map(t=>SLOTS.slice(0,5).map(s=>t.slots[s]));
  // Both starting C-slot players contest the opening tip. Other stats have no effect.
  const centerIds=active.map(five=>five[4]);
  const centerHeights=centerIds.map(id=>getPlayer(id)?.heightInches);
  const result=determineTipoff(centerHeights[0],centerHeights[1],rnd);
  const tipoff={...result,centerIds,centerHeights,at:now()};
  // Exactly one uniform 25%-each court selection per game, shared by both browsers.
  const courtStyle=chooseCourtStyle(rnd);
  room.game={score:[0,0],secondsLeft:720,quarter:1,periodLength:720,offense:result.winningTeam,active,stats,possessions:0,event:null,fouledOut:[],startedAt:now(),period:'Q1',tipoff,courtStyle};
  room.phase='sim';room.play={at:now()};room.log=[];room.timeout=null;room.foulout=null;
  const heights=centerHeights.map(h=>`${Math.floor(h/12)}'${h%12}\"`);
  const favored=result.probabilities.map(p=>Math.round(p*100));
  log(room,`🏀 TIP-OFF: ${getPlayer(centerIds[0]).name} (${heights[0]}) vs ${getPlayer(centerIds[1]).name} (${heights[1]}) — odds ${favored[0]}/${favored[1]}. ${room.teams[result.winningTeam].name} wins the tip and starts with possession!`);
  broadcast(room);
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
    const bench=eligibleBench(t.roster,g.active[side],g.fouledOut);
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
// Player teamwork determines how reliably each player executes a selected offensive scheme.
// 45 teamwork follows the called plan only ~15% of the time; 99 teamwork nearly always does.
function planDiscipline(id){return clamp((rating(id,'teamwork')-45)/55,.15,1);}
function shotMismatch(offenseId,defenderId,shotType){
  const attacker=getPlayer(offenseId),guard=getPlayer(defenderId);
  const isInterior=shotType==='dunk'||shotType==='layup';
  const scoring=isInterior?(.55*rating(offenseId,'layup')+.45*rating(offenseId,'dunk')):
    shotType==='three'?rating(offenseId,'three'):rating(offenseId,'mid');
  const defense=rating(defenderId,isInterior?'paintDef':'perimeterDef');
  const sizeEdge=isInterior?Math.max(0,(attacker.heightInches-guard.heightInches)*.003):0;
  const strengthEdge=isInterior?Math.max(0,(rating(offenseId,'strength')-rating(defenderId,'strength'))*.0012):0;
  return clamp((scoring-defense)*.0014+sizeEdge+strengthEdge,0,.08);
}
function simulatePlay(room){
  const g=room.game;if(!g)return;
  const offense=g.offense,def=other(offense),ot=room.teams[offense],dt=room.teams[def];
  const shooters=g.active[offense],defenders=g.active[def];
  const scheme=ot.offense,dscheme=dt.defense;
  const high=shooters.slice().sort((a,b)=>ov(b)-ov(a));
  const chaos=scheme==='Pure Chaos',runGun=scheme===RUN_AND_GUN,oldSchool=scheme===OLD_SCHOOL_BUCKETS;
  const roles=offenseRoles(shooters,rating);
  // Shot-clock pressure is modeled within each possession. A late or open kickout
  // sends the ball to the designated arc specialist in Old-School Buckets.
  const seconds=Math.min(g.secondsLeft,10+randomInt(20));
  const shotClockRemaining=Math.max(1,24-Math.floor(seconds*24/29));
  const teamAdherence=shooters.reduce((sum,id)=>sum+planDiscipline(id),0)/shooters.length;
  const screeners=runGun?shooters.filter(id=>!roles.runShooters.includes(id)):oldSchool?roles.oldCutters:shooters;
  const screenQuality=screeners.reduce((sum,id)=>sum+(rating(id,'teamwork')*.65+rating(id,'strength')*.20+rating(id,'passing')*.15),0)/screeners.length;
  const openLook=oldSchool && rnd()<clamp(.13+(screenQuality-65)*.004, .08,.32);
  const kickout=oldSchool && (shotClockRemaining<=5||openLook) && rnd()<clamp(teamAdherence,.20,.98);
  const candidates=runGun?shooters.filter(id=>!roles.screenOnly.includes(id)):shooters;
  const shooter=weightedId(candidates,id=> {
    const discipline=planDiscipline(id);
    const baseline=1;
    let desired=baseline;
    if(scheme===OFFENSE[0])desired=id===high[0]?13:1;
    else if(scheme===OFFENSE[1])desired=high.slice(0,2).includes(id)?8:1;
    else if(scheme===OFFENSE[2])desired=1.5+rating(id,'teamwork')/35;
    else if(scheme===OFFENSE[3])desired=.65+rating(id,'three')/44;
    else if(scheme===OFFENSE[4])desired=.65+(rating(id,'layup')+rating(id,'dunk')+rating(id,'post'))/110;
    else if(chaos){
      const bestMatch=defenders.reduce((best,d)=>Math.max(best,
        shotMismatch(id,d,'layup'),shotMismatch(id,d,'three')),0);
      desired=.6+bestMatch*75+(rating(id,'dribbling')+rating(id,'speed'))/120;
    } else if(runGun){
      // The two best 3PT shooters take nearly all shots; the third player seeks
      // open mid-rangers only if their MID attribute is 80 or above.
      desired=roles.runShooters.includes(id)?12+rating(id,'three')/16:
        id===roles.runThird?(rating(id,'mid')>=80?3.7:.15):0;
    } else if(oldSchool){
      // The best three-point shooter camps at the arc for open/late kickouts.
      // The remaining three move and cut; the big crashes the glass.
      desired=id===roles.oldShooter?(kickout?38:1.2):
        id===roles.oldRebounder?(kickout?.15:1.4):
        kickout?.55:4+rating(id,'mid')/30+rating(id,'layup')/35;
    }
    return Math.max(.05,baseline+discipline*(desired-baseline));
  });
  const discipline=planDiscipline(shooter);
  const teamDiscipline=shooters.reduce((sum,id)=>sum+planDiscipline(id),0)/shooters.length;
  const adherence=.65*discipline+.35*teamDiscipline;
  const threeTarget=runGun?(roles.runShooters.includes(shooter)?.81:.10):
    oldSchool?(shooter===roles.oldShooter?.98:.08):
    scheme===OFFENSE[3]?.68:scheme===OFFENSE[4]?.11:chaos?.36:scheme===OFFENSE[2]?.29:.32;
  const isThree=rnd()<clamp(.32+adherence*(threeTarget-.32),.05,.98);
  const paintTarget=oldSchool?(shooter===roles.oldRebounder?.90:.58):
    runGun?.13:scheme===OFFENSE[4]?.82:chaos?.60:scheme===OFFENSE[3]?.38:.56;
  const inPaint=!isThree&&rnd()<clamp(.56+adherence*(paintTarget-.56),.07,.94);
  const dunkSkill=rating(shooter,'dunk');
  const dunkChance=clamp(.2+(dunkSkill-75)*.008,.02,.62);
  const type=isThree?'three':inPaint?(rnd()<dunkChance?'dunk':'layup'):'mid';
  const shotDistanceFt=type==='three'?threeDistanceFeet(rating(shooter,'three'),shotClockRemaining,rnd):
    type==='mid'?12+Math.floor(rnd()*11):3+Math.floor(rnd()*7);
  // A zone keeps three defenders up top and two close to the rim. Pure Chaos deliberately
  // searches across defenders for favorable size/scoring mismatches using off-ball screens.
  const zoneTargets=dscheme==='3-2 Zone'?(inPaint?defenders.slice(3):defenders.slice(0,3)):defenders;
  // Screen execution is influenced by role specialists, their Teamwork and energy.
  const screenRequested=(chaos&&rnd()<.18+.72*adherence)||
    (runGun&&rnd()<clamp(.47+.35*teamAdherence+(screenQuality-70)*.002,.2,.94))||
    (oldSchool&&rnd()<clamp(.42+.40*teamAdherence+(screenQuality-70)*.002,.2,.94));
  // Every real screen has a specific setter: strength impacts shot quality;
  // IQ sets the exact personal-offensive-foul odds for THAT screen.
  const availableScreeners=screeners.filter(id=>id!==shooter);
  const screen=screenRequested&&availableScreeners.length>0;
  const screenSetterId=screen?weightedId(availableScreeners,id=>Math.max(1,rating(id,'strength'))*planDiscipline(id)):null;
  const screenBonus=screen?screenStrengthBonus(rating(screenSetterId,'strength')):0;
  const huntMismatch=chaos&&screen&&rnd()<.25+.62*adherence;
  const defender=(process.env.NODE_ENV==='test'&&process.env.CC_TEST_ALWAYS_FOUL==='1')?defenders[0]:huntMismatch?weightedId(defenders,id=>.15+shotMismatch(shooter,id,type)*120):
    weightedId(zoneTargets,id=>1+rating(id,inPaint?'paintDef':'perimeterDef')/200);
  const mismatchBonus=huntMismatch?shotMismatch(shooter,defender,type):0;
  // A possession may include a real pass before the chosen shot, unless a
  // dribble/isolation play is called. A passer is an actual on-court teammate.
  const passAttempt=shooters.length>1 && rnd()<(scheme===OFFENSE[2]?.94:runGun||oldSchool?.89:.76);
  const passerCandidates=shooters.filter(id=>id!==shooter);
  const passerId=passAttempt?weightedId(passerCandidates,id=>rating(id,'passing')*planDiscipline(id)*
    (runGun&&roles.screenOnly.includes(id)?2.3:oldSchool&&roles.oldCutters.includes(id)?2.2:1)):null;
  const passerRating=passerId?rating(passerId,'passing'):null; // raw listed Passing: 90+ always immune
  const passDurationMs=passerId?passFlightMs(passerRating):0;
  const passFrom=passerId?OFFENSE_ANCHORS[shooters.indexOf(passerId)]:null;
  const passTo=passerId?OFFENSE_ANCHORS[shooters.indexOf(shooter)]:null;
  const inLane=passerId?passingLaneDefenders(passFrom,passTo,defenders,dscheme==='3-2 Zone'):[];
  let interceptorId=null,interceptionAt=null,passOutcome=null;
  let event='miss',made=false,points=0,assistId=null,reboundId=null,stealId=null,blockId=null,posterDunk=false;
  let foul=false,fouler=null,freeThrowsAttempted=0,freeThrowsMade=0,fouledOutPlayer=null,fouledOutSide=null;
  fatigue(room,seconds);
  // Constant motion and screening cost slightly more energy, especially when teamwork is low.
  if(chaos){for(const id of shooters)ot.energy[id]=clamp(ot.energy[id]-(.20+.30*(1-planDiscipline(id)))*(seconds/17),0,100);}
  if(runGun||oldSchool){for(const id of screeners)ot.energy[id]=clamp(ot.energy[id]-(.09+.22*(1-planDiscipline(id)))*(seconds/17),0,100);}
  // Resolution order prevents a single action triggering multiple turnovers:
  // illegal screen -> errant pass -> in-lane interception -> on-ball steal -> shot.
  // 90+ passers cannot be intercepted regardless of defenders' Steal attributes.
  const illegalScreen=screen && rnd()<illegalScreenChance(rating(screenSetterId,'iq'));
  if(illegalScreen){
    event='illegal-screen';g.stats[screenSetterId].pf++;g.stats[screenSetterId].tov++;
    if(g.stats[screenSetterId].pf>=6){
      g.fouledOut.push(screenSetterId);fouledOutPlayer=screenSetterId;fouledOutSide=offense;
    }
  } else if(passerId && rnd()<passingOutChance(passerRating)){
    event='pass-out-of-bounds';passOutcome='out-of-bounds';g.stats[passerId].tov++;
  } else {
    if(passerId && passerRating<90){
      // Only defenders geometrically in the pass lane can attempt this type
      // of steal. The server uses actual, scheme-dependent court coordinates.
      for(const lanePlayer of inLane){
        if(rnd()<interceptionChance(rating(lanePlayer.id,'steal'),passerRating,true)){
          interceptorId=lanePlayer.id;interceptionAt=lanePlayer.at;
          break;
        }
      }
    }
    if(interceptorId){
      event='interception';passOutcome='intercepted';stealId=interceptorId;
      g.stats[interceptorId].stl++;g.stats[passerId].tov++;
    } else {
      if(passerId)passOutcome='complete';
      // On-ball defender is matched with the shooter/handler; Steal chance
      // is the exact Steal bracket minus the handler's Dribbling deduction.
      const ballSteal=onBallStealChance(rating(defender,'steal'),rating(shooter,'dribbling'));
      if(rnd()<ballSteal){
        event='steal';stealId=defender;g.stats[defender].stl++;g.stats[shooter].tov++;
      }
    }
  }
  if(!['illegal-screen','pass-out-of-bounds','interception','steal'].includes(event)){
    let value=isThree?effectiveOnCourt(room,offense,shooter,'three'):
      inPaint?(.44*effectiveOnCourt(room,offense,shooter,'layup')+.46*effectiveOnCourt(room,offense,shooter,'dunk')+.1*effectiveOnCourt(room,offense,shooter,'post')):
      effectiveOnCourt(room,offense,shooter,'mid');
    value=effective(shooter,ot,value);
    const defensiveRating=inPaint?effectiveOnCourt(room,def,defender,'paintDef'):effectiveOnCourt(room,def,defender,'perimeterDef');
    let defenseBump=(defensiveRating-75)*.0018;
    if(dscheme===DEFENSE[2]&&inPaint)defenseBump+=.11;
    if(dscheme===DEFENSE[3]&&isThree)defenseBump+=.105;
    if(dscheme===DEFENSE[1]&&shooter===high[0])defenseBump+=.11;
    if(dscheme==='3-2 Zone')defenseBump+=isThree?.08:inPaint?-.055:.015;
    const base=isThree?.365:inPaint?.61:.43;
    const screensBonus=screen?.018*adherence+screenBonus*adherence+(screen&&(runGun||oldSchool)?clamp((screenQuality-65)*.0009,0,.035):0):0;
    const mismatchQuality=huntMismatch?mismatchBonus:0;
    let chance=clamp(base+(value-80)*.0075-defenseBump+screensBonus+mismatchQuality-
      (isThree?longThreePenalty(shotDistanceFt):0)+(oldSchool&&kickout&&shooter===roles.oldShooter?.055*adherence:0),.035,.83);
    const blocked=inPaint&&rnd()<clamp(.028+(effectiveOnCourt(room,def,defender,'block')-75)*.0018+(dscheme===DEFENSE[2]?.025:0),.006,.14);
    // Defended shooting attempts: jumper 2%, layup/dunk 5%, plus the shooter's FT-rating bonus.
    // A shooting foul cancels the field-goal attempt and awards 2 or 3 free throws.
    // This prototype does not generate and-one shots or technical/non-shooting fouls.
    const foulChance=shootingFoulChance(type,rating(shooter,'ft'));
    // Isolated test-server mode makes forced-substitution paths testable; never enabled in production.
    const foulTestMode=process.env.NODE_ENV==='test'&&process.env.CC_TEST_ALWAYS_FOUL==='1';
    if(rnd()<(foulTestMode?1:foulChance)){
      foul=true;fouler=defender;event='shooting-foul';
      g.stats[defender].pf++;
      freeThrowsAttempted=isThree?3:2;
      const trips=shootFreeThrows(rating(shooter,'ft'),freeThrowsAttempted,rnd);
      freeThrowsMade=trips.made;
      g.stats[shooter].fta+=trips.attempts;
      g.stats[shooter].ftm+=trips.made;
      g.stats[shooter].pts+=trips.made;
      g.score[offense]+=trips.made;
      points=trips.made;
      if(g.stats[defender].pf>=6){
        g.fouledOut.push(defender);
        fouledOutPlayer=defender;fouledOutSide=def;
      }
    } else {
      g.stats[shooter].fga++;if(isThree)g.stats[shooter].threeA++;
      if(blocked){g.stats[defender].blk++;blockId=defender;event='block';}
      else if(rnd()<chance){
      made=true;points=isThree?3:2;g.score[offense]+=points;g.stats[shooter].pts+=points;g.stats[shooter].fgm++;
      if(isThree)g.stats[shooter].threeM++;event=type;
      // A contested made dunk can trigger a short dual-player poster animation.
      posterDunk=type==='dunk'&&rating(defender,'paintDef')>=60&&
        rnd()<clamp(.18+(rating(shooter,'dunk')-75)*.005,.08,.46);
      // Assists belong to the real successful passer, not a fabricated
      // after-the-fact teammate. Solo scoring plays earn no assist.
      const passerCompliance=shooters.reduce((v,id)=>v+planDiscipline(id),0)/shooters.length;
      const assistChance=clamp(.40+.25*passerCompliance+(scheme===OFFENSE[2]?.12:0)+(chaos&&screen?.10:0)+
        (runGun&&screen?.16:0)+(oldSchool?.18:0),.35,.94);
      if(passerId && passOutcome==='complete' && rnd()<assistChance){
        assistId=passerId;g.stats[assistId].ast++;
      }
      }else event='miss';
    }
    if(!made&&!foul){
      const zoneReboundPenalty=dscheme==='3-2 Zone'?.045:0;
      const rebTeam=rnd()<(inPaint?.74:.80)-zoneReboundPenalty?def:offense;
      const rebRoles=offenseRoles(g.active[rebTeam],rating);
      reboundId=weightedId(g.active[rebTeam],id=>(effectiveOnCourt(room,rebTeam,id,'rebound')+effectiveOnCourt(room,rebTeam,id,'strength')*.16)*
        (room.teams[rebTeam].offense===OLD_SCHOOL_BUCKETS&&id===rebRoles.oldRebounder?4.4:
          room.teams[rebTeam].offense===RUN_AND_GUN&&rebRoles.screenOnly.includes(id)?2.3:1));
      g.stats[reboundId].reb++;
    }
  }
  const timeUsed=Math.min(seconds,g.secondsLeft);g.secondsLeft-=timeUsed;g.possessions++;
  const shooterName=getPlayer(shooter).name;
  const deepThree=isDeepThree(type,made,shotDistanceFt);
  const actionPrefix=chaos&&screen?(huntMismatch?'Pure Chaos finds a mismatch! ':'Pure Chaos screen frees a scorer! '):
    runGun&&screen?'Run & Gun screens spring a scorer! ':
    oldSchool&&kickout?'Old-School kickout to the arc! ':
    oldSchool&&screen?'Old-School cuts create an opening! ':'';
  if(event==='illegal-screen')log(room,`🚫 ILLEGAL SCREEN! ${getPlayer(screenSetterId).name} is called for an offensive foul (${g.stats[screenSetterId].pf} PF). Turnover.`);
  else if(event==='pass-out-of-bounds')log(room,`🏀 OUT OF BOUNDS! ${getPlayer(passerId).name}'s pass sails out. Turnover.`);
  else if(event==='interception')log(room,`✋ INTERCEPTION! ${getPlayer(interceptorId).name} reads the passing lane and picks off ${getPlayer(passerId).name}'s pass!`);
  else if(foul)log(room,`WHISTLE! ${getPlayer(fouler).name} fouls ${shooterName} on a ${type==='three'?'three-pointer':type==='mid'?'mid-range jumper':type}. ${freeThrowsMade}/${freeThrowsAttempted} free throws made. ${getPlayer(fouler).name} has ${g.stats[fouler].pf} personal foul(s).`);
  else if(event==='steal')log(room,`✋ ON-BALL STEAL! ${getPlayer(defender).name} strips ${shooterName}!`);
  else if(event==='block')log(room,`${getPlayer(defender).name} blocks ${shooterName}!`);
  else if(posterDunk)log(room,`🔥 POSTER DUNK! ${shooterName} dunks on ${getPlayer(defender).name}!`);
  else if(deepThree)log(room,`🔥 FROM DEEP! 🔥 ${shooterName} drains a ${shotDistanceFt}-foot three-pointer!${assistId?' Assisted by '+getPlayer(assistId).name+'.':''}`);
  else if(made)log(room,`${actionPrefix}${shooterName} scores ${points} ${points===3?'from deep':'points'}!${assistId?' Assisted by '+getPlayer(assistId).name+'.':''}`);
  else log(room,`${actionPrefix}${shooterName} misses${isThree?' a three':''}.${reboundId?' '+getPlayer(reboundId).name+' grabs the rebound.':''}`);
  g.event={id:g.possessions,type,displayEvent:event,offense,shooter,defender,assistId,reboundId,stealId,blockId,made,points,posterDunk,deepThree,shotDistanceFt,shotClockRemaining,
    screen,screenSetterId,screenBonus,illegalScreen,mismatch:huntMismatch&&!illegalScreen,kickout,
    passerId:illegalScreen?null:passerId,passFrom:illegalScreen?null:passFrom,
    passTo:illegalScreen?null:passTo,passDurationMs:illegalScreen?0:passDurationMs,
    passOutcome,interceptorId,interceptionAt,
    screeners:runGun?shooters.filter(id=>!roles.runShooters.includes(id)):oldSchool?roles.oldCutters:[],
    arcShooter:oldSchool?roles.oldShooter:null,arcShooters:runGun?roles.runShooters:[],
    oldRebounder:oldSchool?roles.oldRebounder:null,foul,fouler,freeThrowsAttempted,freeThrowsMade,fouledOutPlayer,at:now()};
  if(!fouledOutPlayer)automaticSubs(room);
  g.offense=reboundId&&g.active[offense].includes(reboundId)?offense:other(offense);
  if(g.secondsLeft<=0){
    if(g.quarter<4){g.quarter++;g.secondsLeft=720;g.period='Q'+g.quarter;log(room,`Start of quarter ${g.quarter}.`);}
    else if(g.score[0]===g.score[1]){g.quarter++;g.period='OT'+(g.quarter-4);g.secondsLeft=300;log(room,'Overtime!');}
    else {completeGame(room);return;}
  }
  if(fouledOutPlayer){
    const side=fouledOutSide,slot=g.active[side].indexOf(fouledOutPlayer);
    const reserve=eligibleBench(room.teams[side].roster,g.active[side],g.fouledOut);
    if(!reserve.length){
      // Edge case: the team no longer has five eligible players to field.
      completeNoEligiblePlayers(room,side);return;
    }
    room.foulout={side,playerId:fouledOutPlayer,slot};
    room.phase='foulout';
    log(room,`🚫 ${getPlayer(fouledOutPlayer).name} FOULS OUT (6 PF). Game paused — ${room.teams[side].name} must choose a bench replacement.`);
  }
  broadcast(room);
}

function completeNoEligiblePlayers(room,side){
  const winner=other(side);
  room.teams[winner].wins++;
  room.result={winner,score:room.game.score.slice(),gameNumber:room.gameNumber,forfeit:true,reason:`${room.teams[side].name} has no eligible player to replace a fouled-out player.`};
  log(room,room.result.reason);
  room.foulout=null;
  if(room.format===1||room.teams[winner].wins===4)room.phase='finished';
  else {room.phase='intermission';room.teams.forEach(t=>t.ready=false);}
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
      const id=t.roster.find(pid=>String(pid)===String(data.playerId)),slot=String(data.slot);
      if(room.phase==='timeout'){
        const g=room.game;
        if(!t.roster.includes(id) || !SLOTS.includes(slot))throw Error('Invalid lineup change.');
        if(g.fouledOut.includes(id))throw Error('That player has fouled out and cannot return.');
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
    case 'fouloutSub':{
      if(room.phase!=='foulout'||!room.foulout)throw Error('No foul-out substitution is pending.');
      if(room.foulout.side!==i)throw Error('Only the affected team can make the mandatory substitution.');
      const g=room.game,required=room.foulout;
      const id=t.roster.find(pid=>String(pid)===String(data.playerId));
      if(!eligibleBench(t.roster,g.active[i],g.fouledOut).includes(id))throw Error('Choose an eligible player from your bench.');
      if(g.active[i][required.slot]!==required.playerId)throw Error('The required substitution slot changed unexpectedly.');
      g.active[i][required.slot]=id;
      log(room,`${getPlayer(id).name} replaces fouled-out ${getPlayer(required.playerId).name}. Play resumes.`);
      room.foulout=null;
      room.phase='sim';room.play={at:now()};broadcast(room);break;
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
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,rooms:ROOMS.size,players:PLAYERS.length,version:BUILD_VERSION,gitCommit:process.env.RENDER_GIT_COMMIT||null});
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
    // Never serve stale gameplay code or HTML after a new deployment.
    const ext=path.extname(file);
    const fresh=ext==='.js'||ext==='.css'||ext==='.html';
    res.writeHead(200,{'Content-Type':contentTypes[ext]||'application/octet-stream','Cache-Control':fresh?'no-store':'public,max-age=3600'});
    createReadStream(file).pipe(res);
  }catch(error){json(res,400,{error:error.message||'Unexpected error.'});}
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Court Cash running on http://localhost:${port}`));
