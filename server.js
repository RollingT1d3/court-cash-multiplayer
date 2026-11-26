import http from 'node:http';
import { fadeChance, fadeValue, fadeContestRelief, FADE_SETUP_MS } from './fade-rules.js';
import { fastBreakPlan } from './fast-break-rules.js';
import { passCount, passPath, touchPriority, resolvePassChain, immediatePassShotBonus, boostedShotChance } from './passing-rules.js';
import { possessionTransition, possessionWindow, timeoutControl } from './transition-rules.js';
import { advancePeriod, REGULATION_QUARTER_SECONDS } from './period-rules.js';
import './public/team-colors.js';
const teamColors=globalThis.CourtTeamColors;
import { createAdminAPI } from './admin-v09.js';
import { assistAwardChance } from './assist-rules.js';
import { chooseShotRange, dunkAttemptChance, restrictThreeDistance, desperationThreeAllowed } from './shot-tendencies-v11.js';
import { createWheelStore, selectWeighted } from './wheel-probabilities.js';
import { BOX_AND_ONE, BOX_CHASER_FATIGUE, boxAssignments, boxShotDefenders, boxShotAdjustment } from './defense-box-one.js';
import { readFileSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';
import { shootingFoulChance, shootFreeThrows, eligibleBench } from './foul-rules.js';
import { heightContestAdjustment, heightBlockAdjustment } from './height-rules-v083.js';
import { fatiguedSkill, timeoutRecovery, fatigueAttributePreview } from './fatigue-v084.js';
import { offenseRoles, RUN_AND_GUN, OLD_SCHOOL_BUCKETS, threeDistanceFeet, longThreePenalty, threePointBaseChance, isDeepThree } from './offense-v04.js';
import { determineTipoff } from './tipoff-v041.js';
import { chooseCourtStyle } from './court-styles.js';
import { ankleBreaks, ANKLE_OPEN_SHOT_BONUS } from './ankle-rules-v07.js';
import { PLAY_THROUGH_POINT, CLOG_THE_LANES, pointPlay, clogPositions,
  clogInterceptionChance, CLOG_PAINT_SHOT_BONUS, CLOG_PAINT_REBOUND_BONUS,
  CLOG_BLOCK_FACTOR } from './strategy-v08.js';
import { gameAwards } from './awards-v08.js';
import { FOUR_ONE_ZONE, TWO_TWO_ONE_ZONE, FOUR_ONE_OFFENSIVE_REBOUND_BONUS,
  TWO_TWO_ONE_DEFENDER_FATIGUE_FACTOR, TWO_TWO_ONE_ATTACKER_FATIGUE_FACTOR,
  zoneShotDefenseAdjustment, zoneDefendersForShot, twoTwoOneEightSecond,
  zoneLaneInterceptionChance, zoneOnBallStealChance, zoneAnchorOverrides } from './defense-v081.js';
import { RUN_FOR_THE_HILLS, FULL_COURT_PRESS, hillsInbounder, hillsRoutes,
  HILLS_SPEED_MULTIPLIER, HILLS_STAMINA_MULTIPLIER,
  PRESS_DEFENSE_STAMINA_MULTIPLIER, PRESS_OFFENSE_STAMINA_MULTIPLIER,
  pressForcesEightSeconds, pressOnBallChance, hillsOffensiveReboundChance, pickHillsPutback, PRESS_DEFENSE_ANCHORS } from './strategy-v06.js';
import { illegalScreenChance, passingOutChance, interceptionChance, onBallStealChance, screenStrengthBonus, passFlightMs, OFFENSE_ANCHORS, passingLaneDefenders } from './court-rules-v05.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS = ['data/players.json','data/players-3.json'].flatMap(file=>JSON.parse(readFileSync(path.join(ROOT,file),'utf8')));
const BUILD_VERSION = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
if (new Set(PLAYERS.map(p => p.id)).size !== PLAYERS.length || PLAYERS.length < 16) throw Error('Players need unique IDs; at least 16 required.');
const wheelStore = createWheelStore({root:ROOT,players:PLAYERS,preferPublishedDefaults:true});
const ROOMS = new Map();
const SLOTS = ['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
const OFFENSE = ['Play Through Superstar','Play Through Stars','Team Ball','Live By the 3, Die by the 3','Paint Mash','Pure Chaos',RUN_AND_GUN,OLD_SCHOOL_BUCKETS,RUN_FOR_THE_HILLS,PLAY_THROUGH_POINT];
const DEFENSE = ['Man-to-Man','Double the Star','Protect the Paint','Perimeter Secured','3-2 Zone',FULL_COURT_PRESS,CLOG_THE_LANES,FOUR_ONE_ZONE,TWO_TWO_ONE_ZONE,BOX_AND_ONE];
const TIMEOUTS_PER_GAME = 6;
const TIMEOUT_MS = 45000;
// Optional short durations for automated integration tests. Production defaults remain unchanged.
const COIN_MS = Math.max(20,Number(process.env.COIN_MS)||3200);
const SPIN_MS = Math.max(20,Number(process.env.SPIN_MS)||2600);
const AUCTION_MS = Math.max(20,Number(process.env.AUCTION_MS)||30000);
// ~123 possessions at ~19.5 simulated seconds each in 40-minute regulation;
// animation windows can extend the base 3.25-second possession interval.
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
const teamNew = (name,key,color) => ({name:safeName(name),color,token:key,budget:5000,roster:[],slots:Object.fromEntries(SLOTS.map(s=>[s,null])),offense:OFFENSE[0],defense:DEFENSE[0],ready:false,wins:0,timeouts:TIMEOUTS_PER_GAME,connected:false,disconnectedAt:null,energy:{}});
function create(name,format,color) {
  let code;
  do {code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();} while(ROOMS.has(code));
  const key=token();
  const weights=wheelStore.snapshot();
  const room={weights,code,format:fmt(format),phase:'lobby',teams:[teamNew(name,key,teamColors.choose(color,0)),null],lastActive:now(),listeners:[new Set(),new Set()],coinWinner:null,coinAt:0,spinIndex:0,remaining:PLAYERS.filter(p=>weights[p.id]>0).map(p=>p.id),wheel:null,auction:null,pending:null,play:null,game:null,gameNumber:0,log:[],timeout:null,foulout:null,result:null,rematchReady:[false,false],departed:[false,false]};
  ROOMS.set(code,room);return {code,token:key,teamIndex:0};
}
function join(code,name,color){
  const room=ROOMS.get(String(code||'').toUpperCase());
  if(!room)throw Error('That room code does not exist.');
  if(room.teams[1])throw Error('Room is already full.');
  if(room.phase!=='lobby')throw Error('That match has already started.');
  const key=token();room.teams[1]=teamNew(name,key,teamColors.choose(color,1,room.teams[0].color));
  room.phase='coinflip';room.coinWinner=randomInt(2);room.coinAt=now();room.lastActive=now();
  broadcast(room);
  return {code:room.code,token:key,teamIndex:1};
}
function publicState(room,i){
  const removeSecret=t=>t?({name:t.name,color:t.color,budget:t.budget,roster:t.roster,slots:t.slots,offense:t.offense,defense:t.defense,ready:t.ready,wins:t.wins,timeouts:t.timeouts,connected:t.connected,energy:t.energy,fatigueRatings:Object.fromEntries(t.roster.map(id=>[id,fatigueAttributePreview(getPlayer(id).stats,t.energy[id]??100)]))}):null;
  return {you:i,code:room.code,format:room.format,phase:room.phase,teams:room.teams.map(removeSecret),coinWinner:room.coinWinner,coinAt:room.coinAt,spinIndex:room.spinIndex,remaining:room.remaining,players:PLAYERS.map(p=>({...p,weight:room.weights[p.id]})),wheel:room.wheel,auction:room.auction,pending:room.pending,play:room.play,game:room.game,timeoutControl:room.phase==='sim'?timeoutControl(room.game,room.play,SIM_MS,!!room.finishAnimation):null,gameNumber:room.gameNumber,log:room.log.slice(-14),timeout:room.timeout,foulout:room.foulout,result:room.result,rematchReady:room.rematchReady,departed:room.departed,serverTime:now()};
}
function broadcast(room){room.lastActive=now();for(let i=0;i<2;i++)for(let res of room.listeners[i]){try{res.write(`data: ${JSON.stringify(publicState(room,i))}\n\n`);}catch{room.listeners[i].delete(res);}}}
function log(room,msg){room.log.push(msg);if(room.log.length>120)room.log.shift();}
function pickPlayer(room){
  return selectWeighted(room.remaining,room.weights,rnd);
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
  // In a normal auction the designated opening team automatically bids $1.00.
  // The opponent acts first: raise by at least $0.50, pass, or time out.
  room.auction={playerId:id,mode,turn:mode==='normal'?other(open):chooser,highBidder:mode==='normal'?open:null,bid:mode==='normal'?100:0,opening:open,deadline:now()+AUCTION_MS,recipient};
  if(mode==='auto'){award(room,recipient,0);return;}
  if(mode==='normal')log(room,`${room.teams[open].name} automatically opens at $1.00.`);
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
function assignSlot(t,id,slot,duringDraft=false){
  if(!SLOTS.includes(slot)||!t.roster.includes(id))throw Error('Invalid player/slot.');
  const current=Object.entries(t.slots).find(([,value])=>value===id)?.[0];
  const displaced=t.slots[slot];
  if(current)t.slots[current]=displaced||null;
  else if(duringDraft&&displaced){
    // A newly drafted player can replace an occupied slot immediately.
    // Keep the displaced player visible: prefer Sixth, Bench 1, Bench 2.
    const destination=[...SLOTS.slice(5),...SLOTS.slice(0,5)].find(s=>s!==slot&&!t.slots[s]);
    if(!destination)throw Error('No available roster slot for displaced player.');
    t.slots[destination]=displaced;
  }
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
function freshStats(){return {pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,fga:0,fgm:0,threeM:0,threeA:0,ftm:0,fta:0,pf:0,ankleBreaks:0,seconds:0};}
function startGame(room){
  room.gameNumber++;
  for(const t of room.teams){t.timeouts=TIMEOUTS_PER_GAME;t.ready=false;t.energy=Object.fromEntries(t.roster.map(id=>[id,100]));}
  const stats=Object.fromEntries(room.teams.flatMap(t=>t.roster.map(id=>[id,freshStats()])));
  const active=room.teams.map(t=>SLOTS.slice(0,5).map(s=>t.slots[s]));
  const bench=room.teams.map(t=>SLOTS.slice(5).map(s=>t.slots[s]));
  // Both starting C-slot players contest the opening tip. Other stats have no effect.
  const centerIds=active.map(five=>five[4]);
  const centerHeights=centerIds.map(id=>getPlayer(id)?.heightInches);
  const result=determineTipoff(centerHeights[0],centerHeights[1],rnd);
  const tipoff={...result,centerIds,centerHeights,at:now()};
  // Exactly one uniform 25%-each court selection per game, shared by both browsers.
  const courtStyle=chooseCourtStyle(rnd);
  room.game={score:[0,0],secondsLeft:REGULATION_QUARTER_SECONDS,quarter:1,periodLength:REGULATION_QUARTER_SECONDS,offense:result.winningTeam,active,bench,stats,touchDrought:{},possessions:0,event:null,fouledOut:[],startedAt:now(),period:'Q1',tipoff,courtStyle};
  room.phase='sim';room.play={at:now()};room.finishAnimation=null;room.log=[];room.timeout=null;room.foulout=null;room.rematchReady=[false,false];room.result=null;
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

// Only shot creation and finishing incur offensive fatigue penalties.
function effective(id,team,skill,category){return fatiguedSkill(skill,team.energy[id]??100,category);}
function defensiveSkill(room,side,id,key){
  return fatiguedSkill(effectiveOnCourt(room,side,id,key),room.teams[side].energy[id]??100,'defense');
}
function weightedId(ids,fun){const weights=ids.map(id=>Math.max(.01,fun(id)));let r=rnd()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<ids.length;i++){r-=weights[i];if(r<=0)return ids[i];}return ids.at(-1);}
function fatigue(room,seconds,boxChaser=null){
  const g=room.game;
  for(let i=0;i<2;i++){
    const t=room.teams[i];
    for(const id of t.roster){
      if(g.active[i].includes(id)){
        const stamina=rating(id,'stamina');
        let drain=(.22+(100-stamina)*.034)*(seconds/17);
        if(t.defense===FULL_COURT_PRESS)drain*=PRESS_DEFENSE_STAMINA_MULTIPLIER;
        if(room.teams[other(i)].defense===FULL_COURT_PRESS)drain*=PRESS_OFFENSE_STAMINA_MULTIPLIER;
        if(i===g.offense&&t.offense===RUN_FOR_THE_HILLS)drain*=HILLS_STAMINA_MULTIPLIER;
        if(i!==g.offense&&t.defense===TWO_TWO_ONE_ZONE)drain*=TWO_TWO_ONE_DEFENDER_FATIGUE_FACTOR;
        if(i!==g.offense&&t.defense===BOX_AND_ONE&&id===boxChaser)drain*=BOX_CHASER_FATIGUE;
        if(i===g.offense&&room.teams[other(i)].defense===TWO_TWO_ONE_ZONE)drain*=TWO_TWO_ONE_ATTACKER_FATIGUE_FACTOR;
        t.energy[id]=clamp((t.energy[id]??100)-drain,0,100);
        g.stats[id].seconds+=seconds;
      }else t.energy[id]=clamp((t.energy[id]??100)+1.5*(seconds/15),0,100);
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
  // Height is already applied to every shot below, so Pure Chaos must not
  // add its former interior height bonus a second time.
  const strengthEdge=isInterior?Math.max(0,(rating(offenseId,'strength')-rating(defenderId,'strength'))*.0012):0;
  return clamp((scoring-defense)*.0014+strengthEdge,0,.08);
}
function simulatePlay(room){
  const g=room.game;if(!g)return;
  const offense=g.offense,def=other(offense),ot=room.teams[offense],dt=room.teams[def];
  // A team that legally called timeout retains possession and must inbound
  // when play resumes. Clear the flag only as that next possession begins.
  const inboundAfterTimeout=g.timeoutInboundSide===offense;
  g.timeoutInboundSide=null;
  const shooters=g.active[offense],defenders=g.active[def];
  const fastBreak=fastBreakPlan({previous:g.event,offense,quarter:g.quarter,seconds:g.secondsLeft,active:shooters,defenders,rating,energy:id=>(ot.energy[id]??dt.energy[id]??100),timeout:inboundAfterTimeout,random:rnd});
  const quickBreak=!!fastBreak&&fastBreak.mode!=='reset';
  const scheme=quickBreak?'Fast Break':ot.offense,dscheme=quickBreak?'Man-to-Man':dt.defense;
  const high=shooters.slice().sort((a,b)=>ov(b)-ov(a));
  const chaos=scheme==='Pure Chaos',runGun=scheme===RUN_AND_GUN,oldSchool=scheme===OLD_SCHOOL_BUCKETS;
  const hills=scheme===RUN_FOR_THE_HILLS,fullCourtPress=dscheme===FULL_COURT_PRESS;
  const point=scheme===PLAY_THROUGH_POINT,clog=dscheme===CLOG_THE_LANES;
  const fourOne=dscheme===FOUR_ONE_ZONE,twoTwoOne=dscheme===TWO_TWO_ONE_ZONE;
  const pointAction=point?pointPlay(shooters,rating,rnd):null;
  const hillsPlay=hills?hillsRoutes(shooters,hillsInbounder(shooters,rating),rating,rnd):null;
  const box=dscheme===BOX_AND_ONE?boxAssignments(shooters,defenders,ov,rating,pointAction?.targets||hillsPlay?.targets||Object.fromEntries(shooters.map((id,i)=>[id,OFFENSE_ANCHORS[i]]))):null;
  const roles=offenseRoles(shooters,rating);
  // Shot-clock pressure is modeled within each possession. A late or open kickout
  // sends the ball to the designated arc specialist in Old-School Buckets.
  let seconds=quickBreak?fastBreak.seconds:Math.min(g.secondsLeft,10+randomInt(20));
  const shotClockRemaining=Math.max(1,24-Math.floor(seconds*24/29));
  const teamAdherence=shooters.reduce((sum,id)=>sum+planDiscipline(id),0)/shooters.length;
  const screeners=point?[pointAction.center]:runGun?shooters.filter(id=>!roles.runShooters.includes(id)):oldSchool?roles.oldCutters:shooters;
  const screenQuality=screeners.reduce((sum,id)=>sum+(rating(id,'teamwork')*.65+rating(id,'strength')*.20+rating(id,'passing')*.15),0)/screeners.length;
  const openLook=oldSchool && rnd()<clamp(.13+(screenQuality-65)*.004, .08,.32);
  const kickout=oldSchool && (shotClockRemaining<=5||openLook) && rnd()<clamp(teamAdherence,.20,.98);
  const candidates=runGun?shooters.filter(id=>!roles.screenOnly.includes(id)):shooters;
  const shooter=quickBreak?fastBreak.shooter:point?pointAction.shooter:hills?hillsPlay.shooter:weightedId(candidates,id=> {
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
  const paintTarget=oldSchool?(shooter===roles.oldRebounder?.90:.58):
    runGun?.13:scheme===OFFENSE[4]?.82:chaos?.60:scheme===OFFENSE[3]?.38:.56;
  const protectedRange=scheme===OFFENSE[3]?'three':scheme===OFFENSE[4]?'paint':
    runGun?(roles.runShooters.includes(shooter)?'three':'mid'):
    oldSchool?(shooter===roles.oldShooter?'three':'paint'):null;
  const shotRange=quickBreak?(fastBreak.type==='three'?'three':fastBreak.type==='mid'?'mid':'paint'):
    point?pointAction.range:hills?(hillsPlay.perimeterShot?(rating(shooter,'three')>=rating(shooter,'mid')?'three':'mid'):'paint'):
    chooseShotRange({threeTarget,paintTarget,adherence,protectedRange,stats:{
      three:rating(shooter,'three'),mid:rating(shooter,'mid'),layup:rating(shooter,'layup'),dunk:rating(shooter,'dunk')
    }},rnd);
  const isThree=shotRange==='three',inPaint=shotRange==='paint';
  const dunkChance=dunkAttemptChance(rating(shooter,'dunk'),rating(shooter,'layup'));
  let type=quickBreak?fastBreak.type:isThree?'three':inPaint?(rnd()<dunkChance?'dunk':'layup'):'mid';
  const desperation=desperationThreeAllowed({seconds:g.secondsLeft,previous:g.event,offense,quarter:g.quarter,timeout:inboundAfterTimeout});
  let shotDistanceFt=quickBreak?fastBreak.feet:type==='three'?restrictThreeDistance(threeDistanceFeet(rating(shooter,'three'),shotClockRemaining,rnd),rating(shooter,'three'),{desperation,random:rnd}):
    type==='mid'?12+Math.floor(rnd()*11):3+Math.floor(rnd()*7);
  // A zone keeps three defenders up top and two close to the rim. Pure Chaos deliberately
  // searches across defenders for favorable size/scoring mismatches using off-ball screens.
  const zoneTargets=box?boxShotDefenders(box,shooter,inPaint):dscheme==='3-2 Zone'?(inPaint?defenders.slice(3):defenders.slice(0,3)):
    zoneDefendersForShot(dscheme,defenders,inPaint);
  // Screen execution is influenced by role specialists, their Teamwork and energy.
  const screenRequested=(chaos&&rnd()<.18+.72*adherence)||
    (runGun&&rnd()<clamp(.47+.35*teamAdherence+(screenQuality-70)*.002,.2,.94))||
    (oldSchool&&rnd()<clamp(.42+.40*teamAdherence+(screenQuality-70)*.002,.2,.94))||
    (point&&pointAction.screen);
  // Every real screen has a specific setter: strength impacts shot quality;
  // IQ sets the exact personal-offensive-foul odds for THAT screen.
  const availableScreeners=screeners.filter(id=>id!==shooter);
  const screen=point?pointAction.screen:screenRequested&&availableScreeners.length>0;
  const screenSetterId=screen?(point?pointAction.center:weightedId(availableScreeners,id=>Math.max(1,rating(id,'strength'))*planDiscipline(id))):null;
  const screenBonus=screen?screenStrengthBonus(rating(screenSetterId,'strength')):0;
  const huntMismatch=chaos&&screen&&rnd()<.25+.62*adherence;
  const defender=(process.env.NODE_ENV==='test'&&process.env.CC_TEST_ALWAYS_FOUL==='1')?defenders[0]:quickBreak?fastBreak.defender:huntMismatch?weightedId(box?zoneTargets:defenders,id=>.15+shotMismatch(shooter,id,type)*120):
    weightedId(zoneTargets,id=>1+rating(id,inPaint?'paintDef':'perimeterDef')/200);
  const mismatchBonus=huntMismatch?shotMismatch(shooter,defender,type):0;
  // Strategy and teamwork control a varied number of half-court passes.
  let plannedPassCount=quickBreak?(fastBreak.mode==='solo'?0:1):passCount(scheme,teamDiscipline,seconds,rnd,pointAction?.passer?1:0);
  const preferredFinal=point?pointAction.passer:null;
  const preferredFirst=hills?hillsPlay.inbounder:null;
  let path=quickBreak?(fastBreak.mode==='solo'?[shooter]:[fastBreak.thief,shooter]):passPath(shooters,shooter,plannedPassCount,preferredFinal,preferredFirst,id=>rating(id,'passing')*planDiscipline(id)*
    (runGun&&roles.screenOnly.includes(id)?2.3:oldSchool&&roles.oldCutters.includes(id)?2.2:1)*touchPriority(g.touchDrought?.[id]),rnd);
  if(fastBreak?.mode==='reset'&&path[0]!==fastBreak.thief&&seconds>=4){
    // Retain control through a real entry pass when the defense recovers.
    const maxPasses=Math.max(1,Math.min(5,Math.floor((seconds-4)/3)));
    while(path.length>maxPasses)path.shift();
    if(path[0]!==fastBreak.thief)path.unshift(fastBreak.thief);
    plannedPassCount=path.length-1;
  }
  const firstHandler=path[0];
  const passAnchor=id=>quickBreak?(id===fastBreak.thief&&fastBreak.from?fastBreak.from:id===shooter&&fastBreak.to?fastBreak.to:fastBreak.targets[id]):point?pointAction.targets[id]:hills?(hillsPlay.targets[id]||{x:.60,y:.50}):OFFENSE_ANCHORS[shooters.indexOf(id)];
  let passerId=path.length>1?path.at(-2):null,passFrom=passerId?passAnchor(passerId):null,passTo=passerId?passAnchor(shooter):null;
  let passDurationMs=0,passes=[],interceptorId=null,interceptionAt=null,passOutcome=null;
  let clogTargets=clog?clogPositions(passFrom,passTo,defenders):null;
  const zonePositions=quickBreak?fastBreak.recoveryTargets:box?box.positions:zoneAnchorOverrides(dscheme,defenders);
  let event='miss',made=false,points=0,assistId=null,reboundId=null,stealId=null,blockId=null,posterDunk=false,ankleBreaker=false;
  let putbackAttempt=false,putbackMade=false,putbackShooter=null;
  const eightSecondViolation=fullCourtPress?pressForcesEightSeconds(rnd):
    twoTwoOne&&twoTwoOneEightSecond(rnd);
  if(eightSecondViolation)seconds=Math.min(g.secondsLeft,8);
  let foul=false,fouler=null,freeThrowsAttempted=0,freeThrowsMade=0,fouledOutPlayer=null,fouledOutSide=null;
  const freeThrowResults=[];
  fatigue(room,seconds,box?.chaser);
  // Constant motion and screening cost slightly more energy, especially when teamwork is low.
  if(chaos){for(const id of shooters)ot.energy[id]=clamp(ot.energy[id]-(.20+.30*(1-planDiscipline(id)))*(seconds/17),0,100);}
  if(runGun||oldSchool){for(const id of screeners)ot.energy[id]=clamp(ot.energy[id]-(.09+.22*(1-planDiscipline(id)))*(seconds/17),0,100);}
  // Resolution order prevents a single action triggering multiple turnovers:
  // illegal screen -> errant pass -> in-lane interception -> on-ball steal -> dribble ankle break -> shot.
  // 90+ passers cannot be intercepted regardless of defenders' Steal attributes.
  const illegalScreen=!eightSecondViolation&&screen&&rnd()<illegalScreenChance(rating(screenSetterId,'iq'));
  if(eightSecondViolation){
    event='eight-second-violation';
    g.stats[passerId||shooter].tov++;
  } else if(illegalScreen){
    event='illegal-screen';g.stats[screenSetterId].pf++;g.stats[screenSetterId].tov++;
    if(g.stats[screenSetterId].pf>=6){
      g.fouledOut.push(screenSetterId);fouledOutPlayer=screenSetterId;fouledOutSide=offense;
    }
  } else {
    const resolved=resolvePassChain(path,(fromId,toId)=>{
      const from=passAnchor(fromId),to=passAnchor(toId),passerRating=rating(fromId,'passing');
      const coverage=clog?clogPositions(from,to,defenders):null;
      const inLane=passingLaneDefenders(from,to,defenders,dscheme==='3-2 Zone',fullCourtPress,coverage||(quickBreak?fastBreak.passDefense:zonePositions));
      const pass={from,to,durationMs:passFlightMs(passerRating),outcome:'complete',interceptorId:null,interceptionAt:null,clogPositions:coverage};
      if(rnd()<passingOutChance(passerRating))pass.outcome='out-of-bounds';
      else if(passerRating<90){
        for(const lanePlayer of inLane){
          const baseLaneChance=interceptionChance(fatiguedSkill(rating(lanePlayer.id,'steal'),dt.energy[lanePlayer.id]??100,'defense'),passerRating,true);
          const chance=clog?clogInterceptionChance(baseLaneChance,passerRating):zoneLaneInterceptionChance(baseLaneChance,passerRating,dscheme);
          if(rnd()<chance){pass.outcome='intercepted';pass.interceptorId=lanePlayer.id;pass.interceptionAt=lanePlayer.at;break;}
        }
      }
      return pass;
    });
    passes=resolved.attempts;passDurationMs=resolved.durationMs;
    if(quickBreak&&passes.at(-1)?.outcome==='complete')passDurationMs+=fastBreak.afterMs;
    const last=passes.at(-1);
    passerId=last?.fromId??null;passFrom=last?.from??null;passTo=last?.to??null;passOutcome=last?.outcome??null;
    interceptorId=last?.interceptorId??null;interceptionAt=last?.interceptionAt??null;
    clogTargets=last?.clogPositions||clogTargets;
    if(passOutcome==='out-of-bounds'){
      event='pass-out-of-bounds';g.stats[passerId].tov++;
    }else if(interceptorId){
      event='interception';stealId=interceptorId;
      g.stats[interceptorId].stl++;g.stats[passerId].tov++;
    }else{
      // On-ball defender is matched with the shooter/handler; Steal chance
      // is the exact Steal bracket minus the handler's Dribbling deduction.
      const ballSteal=zoneOnBallStealChance(
        pressOnBallChance(onBallStealChance(fatiguedSkill(rating(defender,'steal'),dt.energy[defender]??100,'defense'),rating(shooter,'dribbling')),fullCourtPress),dscheme);
      if(rnd()<ballSteal*(quickBreak?.35:1)){
        event='steal';stealId=defender;g.stats[defender].stl++;g.stats[shooter].tov++;
      } else {
        // Only a genuine ball handler with control after the inbound/pass can
        // break the matched defender. Use LISTED ratings, never fatigue/OVR.
        const testForce=process.env.NODE_ENV==='test'&&process.env.CC_TEST_FORCE_ANKLE==='1';
        ankleBreaker=(testForce&&rating(defender,'perimeterDef')<99)||
          (!quickBreak&&ankleBreaks(rating(shooter,'dribbling'),rating(defender,'perimeterDef'),rnd));
        if(ankleBreaker)g.stats[shooter].ankleBreaks++;
      }
    }
  }
  let fadeSetupMs=0,postFade=false,passShotBoost=0;
  if(!['eight-second-violation','illegal-screen','pass-out-of-bounds','interception','steal'].includes(event)){
    const fadeRating=rating(shooter,'fades');
    const fadeOdds=fadeChance({type,quickBreak,ankleBreaker,fades:fadeRating,mid:rating(shooter,'mid'),post:rating(shooter,'post'),iq:rating(shooter,'iq'),defense:defensiveSkill(room,def,defender,inPaint?'paintDef':'perimeterDef'),heightGap:getPlayer(defender).heightInches-getPlayer(shooter).heightInches,screen,shotClockRemaining,scheme});
    if(fadeOdds>0&&rnd()<fadeOdds){postFade=inPaint;type='fade';fadeSetupMs=FADE_SETUP_MS;if(postFade)shotDistanceFt=9+Math.floor(rnd()*4);}
    const fading=type==='fade';
    let value=fading?fadeValue(effectiveOnCourt(room,offense,shooter,'fades'),effectiveOnCourt(room,offense,shooter,postFade?'post':'mid')):isThree?effectiveOnCourt(room,offense,shooter,'three'):
      quickBreak&&inPaint?effectiveOnCourt(room,offense,shooter,type):
      inPaint?(.44*effectiveOnCourt(room,offense,shooter,'layup')+.46*effectiveOnCourt(room,offense,shooter,'dunk')+.1*effectiveOnCourt(room,offense,shooter,'post')):
      effectiveOnCourt(room,offense,shooter,'mid');
    value=effective(shooter,ot,value,inPaint&&!fading?'finishing':'shooting');
    const defensiveRating=defensiveSkill(room,def,defender,inPaint?'paintDef':'perimeterDef');
    let defenseBump=(defensiveRating-75)*.0018;
    if(dscheme===DEFENSE[2]&&inPaint)defenseBump+=.11;
    if(dscheme===DEFENSE[3]&&isThree)defenseBump+=.105;
    if(dscheme===DEFENSE[1]&&shooter===high[0])defenseBump+=.11;
    if(dscheme==='3-2 Zone')defenseBump+=isThree?.08:inPaint?-.055:.015;
    if(clog&&inPaint)defenseBump-=CLOG_PAINT_SHOT_BONUS;
    const coverageType=fading?(postFade?'layup':'mid'):type;
    defenseBump+=zoneShotDefenseAdjustment(dscheme,coverageType);
    if(box)defenseBump+=boxShotAdjustment(box,shooter,coverageType);
    if(fading&&defenseBump>0)defenseBump*=1-fadeContestRelief(fadeRating);
    const rawThree=isThree?rating(shooter,'three'):0;
    const base=fading?(postFade?.43:.38):isThree?threePointBaseChance(rawThree):inPaint?.61:.43;
    // Preserve fatigue and out-of-position penalties without tier-cliff effects.
    const skillAdjustment=(value-(isThree?rawThree:80))*.0075;
    const screensBonus=screen?.018*adherence+screenBonus*adherence+(screen&&(runGun||oldSchool)?clamp((screenQuality-65)*.0009,0,.035):0):0;
    const mismatchQuality=huntMismatch?mismatchBonus:0;
    let heightContest=heightContestAdjustment(getPlayer(shooter).heightInches,getPlayer(defender).heightInches,type);
    if(fading&&heightContest<0)heightContest*=1-fadeContestRelief(fadeRating);
    let chance=clamp(base+skillAdjustment+heightContest-defenseBump+screensBonus+mismatchQuality-
      (isThree?longThreePenalty(shotDistanceFt,rawThree):0)+(oldSchool&&kickout&&shooter===roles.oldShooter?.055*adherence:0)+
      (hills&&inPaint?(HILLS_SPEED_MULTIPLIER-1)*.20:0)+
      (ankleBreaker?ANKLE_OPEN_SHOT_BONUS:0)+(quickBreak?fastBreak.openBonus:0),.035,ankleBreaker?.89:quickBreak?.88:.83);
    // A stumbling guard temporarily cannot recover in time to block the shot.
    const heightBlock=inPaint?heightBlockAdjustment(getPlayer(shooter).heightInches,getPlayer(defender).heightInches):0;
    const blocked=!ankleBreaker&&inPaint&&rnd()<
      clamp(.028+(defensiveSkill(room,def,defender,'block')-75)*.0018+
        (dscheme===DEFENSE[2]?.025:0)+heightBlock,.006,.14)*(clog?CLOG_BLOCK_FACTOR:1)*(quickBreak?.35:1)*(fading?.45:1);
    // Defended shooting attempts: jumper 2%, layup/dunk 5%, plus the shooter's FT-rating bonus.
    // A shooting foul cancels the field-goal attempt and awards 2 or 3 free throws.
    // This prototype does not generate and-one shots or technical/non-shooting fouls.
    const foulChance=ankleBreaker?0:shootingFoulChance(type,rating(shooter,'ft'))*(quickBreak?.45:1);
    // Isolated test-server mode makes forced-substitution paths testable; never enabled in production.
    const foulTestMode=process.env.NODE_ENV==='test'&&process.env.CC_TEST_ALWAYS_FOUL==='1';
    if(rnd()<(foulTestMode?1:foulChance)){
      foul=true;fouler=defender;event='shooting-foul';
      g.stats[defender].pf++;
      freeThrowsAttempted=isThree?3:2;
      const trips=shootFreeThrows(rating(shooter,'ft'),freeThrowsAttempted,rnd,freeThrowResults);
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
      // No new shot-selection roll: the completed final pass can enhance
      // this one actual field-goal attempt, after all existing modifiers/caps.
      passShotBoost=immediatePassShotBonus({passes,shooter,type,rating,ankleBreaker,postFade,fastBreak});
      chance=boostedShotChance(chance,passShotBoost);
      g.stats[shooter].fga++;if(isThree)g.stats[shooter].threeA++;
      if(blocked){g.stats[defender].blk++;blockId=defender;event='block';}
      else if(rnd()<chance){
      made=true;points=isThree?3:2;g.score[offense]+=points;g.stats[shooter].pts+=points;g.stats[shooter].fgm++;
      if(isThree)g.stats[shooter].threeM++;event=type;
      // A contested made dunk can trigger a short dual-player poster animation.
      posterDunk=!quickBreak&&type==='dunk'&&rating(defender,'paintDef')>=60&&
        rnd()<clamp(.18+(rating(shooter,'dunk')-75)*.005,.08,.46);
      // Assists belong to the real successful passer, not a fabricated
      // after-the-fact teammate. Solo scoring plays earn no assist.
      const passerCompliance=shooters.reduce((v,id)=>v+planDiscipline(id),0)/shooters.length;
      const assistChance=assistAwardChance(passerCompliance,{teamBall:scheme===OFFENSE[2],chaos,runGun,oldSchool,screen});
      if(passerId && passOutcome==='complete' && rnd()<assistChance){
        assistId=passerId;g.stats[assistId].ast++;
      }
      }else event='miss';
    }
    if(!made&&!foul){
      const zoneReboundPenalty=dscheme==='3-2 Zone'?.045:0;
      const reboundBase=1-((inPaint?.74:.80)-zoneReboundPenalty);
      const offenseReboundChance=clamp(hills?hillsOffensiveReboundChance(reboundBase,hillsPlay.perimeterShot):
        reboundBase+(clog?CLOG_PAINT_REBOUND_BONUS:0)+(fourOne?FOUR_ONE_OFFENSIVE_REBOUND_BONUS:0),0,.95);
      const rebTeam=rnd()<offenseReboundChance?offense:def;
      const rebRoles=offenseRoles(g.active[rebTeam],rating);
      reboundId=weightedId(g.active[rebTeam],id=>(effectiveOnCourt(room,rebTeam,id,'rebound')+effectiveOnCourt(room,rebTeam,id,'strength')*.16)*
        (room.teams[rebTeam].offense===OLD_SCHOOL_BUCKETS&&id===rebRoles.oldRebounder?4.4:
          room.teams[rebTeam].offense===RUN_AND_GUN&&rebRoles.screenOnly.includes(id)?2.3:
          room.teams[rebTeam].offense===RUN_FOR_THE_HILLS&&hillsPlay?.paintPlayers.includes(id)?2.5:1));
      g.stats[reboundId].reb++;
      // A crashing offense may get an IMMEDIATE second layup/dunk attempt.
      // The putback is a separate recorded FGA with its own scorer.
      if(hills&&rebTeam===offense&&hillsPlay.paintCrash&&pickHillsPutback(rnd)){
        putbackAttempt=true;putbackShooter=reboundId;
        g.stats[reboundId].fga++;
        const putbackSkill=(rating(reboundId,'layup')+rating(reboundId,'dunk'))/2;
        const putbackChance=clamp(.43+(putbackSkill-75)*.004, .24,.69);
        if(rnd()<putbackChance){
          putbackMade=true;made=true;points=2;event='putback';
          g.stats[reboundId].fgm++;g.stats[reboundId].pts+=2;g.score[offense]+=2;
        }
      }
    }
  }
  // Track actual touches, not planned passes that never happened after a turnover.
  g.touchDrought??={};
  const touched=new Set();
  if(!eightSecondViolation&&!illegalScreen){
    touched.add(firstHandler);
    for(const pass of passes){touched.add(pass.fromId);if(pass.outcome==='complete')touched.add(pass.toId);}
  }
  if(reboundId&&shooters.includes(reboundId))touched.add(reboundId);
  for(const id of shooters)g.touchDrought[id]=touched.has(id)?0:(g.touchDrought[id]??0)+1;
  const timeUsed=Math.min(seconds,g.secondsLeft);g.secondsLeft-=timeUsed;g.possessions++;
  const shooterName=getPlayer(shooter).name;
  const deepThree=isDeepThree(type,made,shotDistanceFt);
  const actionPrefix=quickBreak?'⚡ FAST BREAK! ':point?`🎯 Play Through Point (${pointAction.action})! `:hills?(hillsPlay.perimeterShot?'🏃 Run For The Hills kickout! ':hillsPlay.wantsKickout?'🏃 Routes collapse to the paint! ':'🏃 Everyone crashes the paint! '):chaos&&screen?(huntMismatch?'Pure Chaos finds a mismatch! ':'Pure Chaos screen frees a scorer! '):
    runGun&&screen?'Run & Gun screens spring a scorer! ':
    oldSchool&&kickout?'Old-School kickout to the arc! ':
    oldSchool&&screen?'Old-School cuts create an opening! ':'';
  if(fastBreak)log(room,fastBreak.mode==='reset'?`🏀 ${getPlayer(fastBreak.thief).name} slows down as the defense recovers — ${ot.offense}.`:fastBreak.mode==='outlet'?`⚡ FAST BREAK! ${getPlayer(fastBreak.thief).name} looks for ${shooterName} ahead of the defense.`:fastBreak.mode==='kickout'?`⚡ FAST BREAK! ${getPlayer(fastBreak.thief).name} finds an open teammate after being cut off.`:`⚡ FAST BREAK! ${shooterName} races ahead for a ${type}.`);
  if(passes.length)log(room,`🏀 ${ot.name}: ${passes.filter(p=>p.outcome==='complete').length}/${passes.length} passes completed (${scheme}).`);
  if(ankleBreaker)log(room,`😵‍💫 ANKLE BREAKER! ${shooterName} makes ${getPlayer(defender).name} stumble — wide open!`);
  if(inboundAfterTimeout)log(room,`🏀 ${ot.name} inbounds after its timeout and keeps possession.`);
  if(event==='eight-second-violation')log(room,`⏱️ ${twoTwoOne?'2-2-1 ZONE PRESS':'FULL COURT PRESS'}! ${ot.name} cannot cross half court in 8 seconds. Turnover!`);
  else if(event==='illegal-screen')log(room,`🚫 ILLEGAL SCREEN! ${getPlayer(screenSetterId).name} is called for an offensive foul (${g.stats[screenSetterId].pf} PF). Turnover.`);
  else if(event==='pass-out-of-bounds')log(room,`🏀 OUT OF BOUNDS! ${getPlayer(passerId).name}'s pass sails out. Turnover.`);
  else if(event==='interception')log(room,`✋ INTERCEPTION! ${getPlayer(interceptorId).name} ${clog?'clogs the passing lane':'reads the passing lane'} and picks off ${getPlayer(passerId).name}'s pass!`);
  else if(foul)log(room,`WHISTLE! ${getPlayer(fouler).name} fouls ${shooterName} on a ${type==='three'?'three-pointer':type==='mid'?'mid-range jumper':type}. ${freeThrowsMade}/${freeThrowsAttempted} free throws made. ${getPlayer(fouler).name} has ${g.stats[fouler].pf} personal foul(s).`);
  else if(event==='putback')log(room,`🏀 RUN FOR THE HILLS! ${getPlayer(putbackShooter).name} scores a crashing putback after an offensive rebound!`);
  else if(event==='steal')log(room,`✋ ON-BALL STEAL! ${getPlayer(defender).name} strips ${shooterName}!`);
  else if(event==='block')log(room,`${getPlayer(defender).name} blocks ${shooterName}!`);
  else if(posterDunk)log(room,`💪 POSTER DUNK! ${shooterName} dunks on ${getPlayer(defender).name}!`);
  else if(deepThree)log(room,`🔥 FROM DEEP! 🔥 ${shooterName} drains a ${shotDistanceFt}-foot three-pointer!${assistId?' Assisted by '+getPlayer(assistId).name+'.':''}`);
  else if(type==='fade')log(room,`${actionPrefix}${shooterName} ${made?'scores on':'misses'} a ${postFade?'post ':''}fadeaway!${made&&assistId?' Assisted by '+getPlayer(assistId).name+'.':''}${!made&&reboundId?' '+getPlayer(reboundId).name+' grabs the rebound.':''}`);
  else if(made)log(room,`${actionPrefix}${shooterName} scores ${points} ${points===3?'from deep':'points'}!${assistId?' Assisted by '+getPlayer(assistId).name+'.':''}`);
  else log(room,`${actionPrefix}${shooterName} misses${isThree?' a three':''}.${reboundId?' '+getPlayer(reboundId).name+' grabs the rebound.':''}`);
  const transition=possessionTransition(g.event,offense,g.quarter,shooters,inboundAfterTimeout,firstHandler,hills?hillsPlay.inbounder:null);
  if(quickBreak){transition.durationMs=fastBreak.leadMs;transition.handlerId=fastBreak.thief;}
  // Presentation only: a tight 230ms gather for actual mid-range/three-point jumpers.
  const jumperSetupMs=['mid','three'].includes(type)&&!['eight-second-violation','illegal-screen','pass-out-of-bounds','interception','steal'].includes(event)?230:0;
  g.event={id:g.possessions,quarter:g.quarter,transition,fadeSetupMs,jumperSetupMs,postFade,fastBreak,breakTargets:quickBreak?fastBreak.targets:null,breakDefense:quickBreak?fastBreak.recoveryTargets:null,stealAt:event==='steal'?(quickBreak?fastBreak.shotTarget:{x:clamp(.926-shotDistanceFt/94,.14,.92),y:.5}):null,type,displayEvent:event,offense,shooter,defender,assistId,reboundId,stealId,blockId,made,points,posterDunk,ankleBreaker,ankleBreakerHandler:ankleBreaker?shooter:null,ankleBreakerDefender:ankleBreaker?defender:null,deepThree,shotDistanceFt,shotClockRemaining,inboundAfterTimeout,
    screen,screenSetterId,screenBonus,illegalScreen,mismatch:huntMismatch&&!illegalScreen,kickout,
    passerId:illegalScreen||eightSecondViolation?null:passerId,passFrom:illegalScreen||eightSecondViolation?null:passFrom,
    passTo:illegalScreen||eightSecondViolation?null:passTo,passDurationMs:illegalScreen||eightSecondViolation?0:passDurationMs,
    passOutcome: eightSecondViolation?null:passOutcome,interceptorId,interceptionAt,
    passes,plannedPassCount,firstHandler,passShotBoost,
    hillsMode:hills?(hillsPlay.perimeterShot?'kickout':hillsPlay.paintCrash?'paint-crash':'paint-after-kickout'):null,
    hillsRoutes:hills?hillsPlay.targets:null,hillsInbounder:hills?hillsPlay.inbounder:null,
    hillsShooters:hills?hillsPlay.shooters:[],hillsPaintPlayers:hills?hillsPlay.paintPlayers:[],
    putbackAttempt,putbackMade,putbackShooter,fullCourtPress,eightSecondViolation,
    pointMode:point?pointAction.action:null,pointRoutes:point?pointAction.targets:null,
    pointPG:point?pointAction.pg:null,pointCenter:point?pointAction.center:null,
    pointCorners:point?pointAction.corners:[],pointWingCut:point?pointAction.wingCut:null,
    pointCutReturned:point?pointAction.cutReturned:false,
    clogPositions:clogTargets,clog,zoneDefense:box?BOX_AND_ONE:fourOne?FOUR_ONE_ZONE:twoTwoOne?TWO_TWO_ONE_ZONE:null,
    boxTarget:box?.target??null,boxChaser:box?.chaser??null,boxHigh:box?.high??[],boxLow:box?.low??[],
    zonePositions,attackRight:offense===0?g.quarter<=2:g.quarter>2,
    screeners:runGun?shooters.filter(id=>!roles.runShooters.includes(id)):oldSchool?roles.oldCutters:[],
    arcShooter:oldSchool?roles.oldShooter:null,arcShooters:runGun?roles.runShooters:[],
    oldRebounder:oldSchool?roles.oldRebounder:null,foul,fouler,freeThrowsAttempted,freeThrowsMade,freeThrowResults,
    rimBounces:!foul&&reboundId&&event!=='block'?1+(g.possessions%3):0,fouledOutPlayer,at:now()};
  if(room.play)room.play.delay=possessionWindow(g.event,SIM_MS);
  // All voluntary substitutions are manual and require a timeout.
  g.offense=!putbackMade&&reboundId&&g.active[offense].includes(reboundId)?offense:other(offense);
  if(g.secondsLeft<=0){
    const nextPeriod=advancePeriod(g,room.teams);
    if(nextPeriod==='regulation')log(room,`Start of quarter ${g.quarter}.`);
    else if(nextPeriod==='overtime')log(room,'Overtime! Both teams receive one additional timeout.');
    else {finishAfterAnimation(room,()=>completeGame(room));return;}
  }
  if(fouledOutPlayer){
    const side=fouledOutSide,slot=g.active[side].indexOf(fouledOutPlayer);
    const reserve=eligibleBench(room.teams[side].roster,g.active[side],g.fouledOut);
    if(!reserve.length){
      finishAfterAnimation(room,()=>completeNoEligiblePlayers(room,side));return;
    }
    finishAfterAnimation(room,()=>{
      room.foulout={side,playerId:fouledOutPlayer,slot};
      room.phase='foulout';
      log(room,`🚫 ${getPlayer(fouledOutPlayer).name} FOULS OUT (6 PF). Game paused — ${room.teams[side].name} must choose a bench replacement.`);
      broadcast(room);
    });return;
  }
  broadcast(room);
}

// Keep the last possession visible before results or a mandatory substitution.
// Accelerated integration tests still resolve without real-time animation delays.
function finishAfterAnimation(room,finish){
  if(SIM_MS<3000){finish();return;}
  room.finishAnimation=finish;broadcast(room);
}
function completeNoEligiblePlayers(room,side){
  const winner=other(side);
  room.teams[winner].wins++;
  room.result={winner,score:room.game.score.slice(),gameNumber:room.gameNumber,awards:gameAwards(room.teams,room.game.stats,winner),forfeit:true,reason:`${room.teams[side].name} has no eligible player to replace a fouled-out player.`};
  log(room,room.result.reason);
  room.foulout=null;
  if(room.format===1||room.teams[winner].wins===4)room.phase='finished';
  else {room.phase='intermission';room.teams.forEach(t=>t.ready=false);}
  broadcast(room);
}

function completeGame(room){
  const g=room.game;const winner=g.score[0]>g.score[1]?0:1;room.teams[winner].wins++;
  room.result={winner,score:g.score.slice(),gameNumber:room.gameNumber,awards:gameAwards(room.teams,g.stats,winner),forfeit:false};
  log(room,`${room.teams[winner].name} wins Game ${room.gameNumber}, ${g.score[winner]}–${g.score[other(winner)]}!`);
  if(room.format===1 || room.teams[winner].wins===4)room.phase='finished';
  else {room.phase='intermission';room.teams.forEach(t=>t.ready=false);}
  broadcast(room);
}
function forfeit(room,i,reason=`${room.teams[i].name} disconnected for over 30 seconds.`){if(room.phase==='finished')return;const winner=other(i);room.result={winner,awards:room.game?gameAwards(room.teams,room.game.stats,winner):null,forfeit:true,reason};room.phase='finished';log(room,room.result.reason);broadcast(room);}
function leaveRoom(room,i,confirmed){
  const t=room.teams[i];
  if(room.teams[other(i)]&&room.phase!=='finished'&&confirmed!==true)throw Error('Confirm forfeiting this match.');
  // Explicit departure invalidates the old session and prevents rematches.
  room.departed[i]=true;
  t.token=token();
  t.connected=false;t.disconnectedAt=null;
  room.rematchReady=[false,false];
  const listeners=[...room.listeners[i]];
  room.listeners[i].clear();
  for(const res of listeners)res.end();
  if(!room.teams[other(i)]||room.departed.every(Boolean)){
    ROOMS.delete(room.code);return;
  }
  if(room.phase!=='finished')forfeit(room,i,`${t.name} left the room and forfeited the match.`);
  else broadcast(room);
}
function action(room,i,data){
  const t=room.teams[i],a=room.auction;
  switch(data.type){
    case 'leave':{leaveRoom(room,i,data.confirmForfeit);break;}
    case 'bid':{
      if(room.phase!=='auction'||!a||a.mode!=='normal'||a.turn!==i)throw Error('Not your turn to bid.');
      const amount=Number(data.cents);
      if(!Number.isInteger(amount)||amount<100||amount%50!==0||amount<a.bid+50||amount>t.budget)throw Error('Bid must be a valid $0.50 increment within your budget.');
      a.bid=amount;a.highBidder=i;a.turn=other(i);a.deadline=now()+AUCTION_MS;log(room,`${t.name} bids $${(amount/100).toFixed(2)}.`);broadcast(room);break;
    }
    case 'pass':{
      if(room.phase!=='auction'||!a||a.mode!=='normal'||a.turn!==i)throw Error('Not your turn to pass.');
      // An opening $1.00 bid always exists in normal auctions.
      // Passing awards the player immediately to the current high bidder.
      award(room,a.highBidder,a.bid);break;
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
        const slotIdx=SLOTS.indexOf(slot);
        // Keep the exact bench order, including swaps between two reserves.
        const slotPlayers=g.active[i].concat(g.bench[i]);
        const previousIdx=slotPlayers.indexOf(id);
        if(previousIdx<0)throw Error('Player unavailable.');
        const old=slotPlayers[slotIdx];
        if(slotIdx<5&&g.fouledOut.includes(id)||previousIdx<5&&g.fouledOut.includes(old))throw Error('That player has fouled out and cannot return.');
        slotPlayers[slotIdx]=id;slotPlayers[previousIdx]=old;
        g.active[i]=slotPlayers.slice(0,5);
        g.bench[i]=slotPlayers.slice(5);
        broadcast(room);break;
      }
      assignSlot(t,id,slot,room.phase==='placement');broadcast(room);break;
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
    case 'rematch':{
      if(room.departed.some(Boolean))throw Error('Your opponent has left the room.');
      if(room.phase!=='finished'||!room.game||!room.teams.every(Boolean))throw Error('Rematch is only available after the match is over.');
      room.rematchReady[i]=true;
      if(room.rematchReady.every(Boolean)){
        // Rematch keeps the drafted players, starts a fresh game/series and
        // resets the teams' series wins, timeouts, energy and game statistics.
        room.teams.forEach(t=>{t.wins=0;t.ready=false;});
        room.gameNumber=0;
        startGame(room);
      }else broadcast(room);
      break;
    }
    case 'timeout':{
      if(room.phase!=='sim'||t.timeouts<1)throw Error('No timeouts available.');
      if(room.finishAnimation)throw Error('Wait for the current play to finish.');
      // Possession is server-authoritative; a defending team cannot steal a
      // pause by pressing the API directly, even if its browser is stale.
      if(room.game?.offense!==i)throw Error('Your team must have the ball to call timeout.');
      const control=timeoutControl(room.game,room.play,SIM_MS,!!room.finishAnimation);
      if(!control||now()<control.opensAt)throw Error('Wait for the current play to finish before calling timeout.');
      if(data.playAt!==undefined&&(data.playAt!==control.playAt||data.gameEventId!==control.gameEventId||data.gameNumber!==room.gameNumber))throw Error('Possession changed. Try again when your team has the ball.');
      // Rest all ten on-court players exactly once, when the timeout starts.
        for(let side=0;side<2;side++){
          const team=room.teams[side];
          for(const id of room.game.active[side]){
            team.energy[id]=timeoutRecovery(team.energy[id]??100);
          }
        }
        t.timeouts--;room.phase='timeout';room.timeout={caller:i,possession:i,until:now()+TIMEOUT_MS};
      room.game.timeoutInboundSide=i;
      log(room,`${t.name} calls timeout. Both teams may adjust schemes; only ${t.name} may substitute.`);broadcast(room);break;
    }
    case 'fouloutSub':{
      if(room.phase!=='foulout'||!room.foulout)throw Error('No foul-out substitution is pending.');
      if(room.foulout.side!==i)throw Error('Only the affected team can make the mandatory substitution.');
      const g=room.game,required=room.foulout;
      const id=t.roster.find(pid=>String(pid)===String(data.playerId));
      if(!eligibleBench(t.roster,g.active[i],g.fouledOut).includes(id))throw Error('Choose an eligible player from your bench.');
      if(g.active[i][required.slot]!==required.playerId)throw Error('The required substitution slot changed unexpectedly.');
      const benchIndex=g.bench[i].indexOf(id);
      if(benchIndex<0)throw Error('Player unavailable on bench.');
      g.bench[i][benchIndex]=required.playerId;
      g.active[i][required.slot]=id;
      log(room,`${getPlayer(id).name} replaces fouled-out ${getPlayer(required.playerId).name}. Play resumes.`);
      room.foulout=null;
      room.phase='sim';room.play={at:now(),readyForPossession:true};broadcast(room);break;
    }
    case 'resume':{
      if(room.phase!=='timeout'||room.timeout.caller!==i)throw Error('Only the caller can resume early.');
      // Do not advance or switch possession during the timeout.
      room.game.offense=room.timeout.possession;
      room.game.timeoutInboundSide=room.timeout.possession;
      room.phase='sim';room.play={at:now(),readyForPossession:true};room.timeout=null;broadcast(room);break;
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
        // The opponent's clock expiring awards the player to the standing high bidder.
        award(room,a.highBidder,a.bid);
      }
    }
    if(room.phase==='timeout'&&ms>=room.timeout.until){
      room.game.offense=room.timeout.possession;
      room.game.timeoutInboundSide=room.timeout.possession;
      room.phase='sim';room.play={at:ms,readyForPossession:true};room.timeout=null;broadcast(room);
    }
    if(room.phase==='sim'&&ms-(room.play?.at||0)>=(room.play?.delay||SIM_MS)){
      room.play={at:ms};
      if(room.finishAnimation){const finish=room.finishAnimation;room.finishAnimation=null;finish();}
      else simulatePlay(room);
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

const adminAPI = createAdminAPI({ root: ROOT, players: PLAYERS, wheelStore, publishedCropIds: ["p201","p204","p208","p209","p211","p212","p215","p216"], onUpdate: () => {
  for (const room of ROOMS.values()) broadcast(room);
} });

const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function body(req){let chunks=[],total=0;for await(const part of req){total+=part.length;if(total>1e5)throw Error('Request too large.');chunks.push(part);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try{
    if(await adminAPI(req,res,url))return;
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,rooms:ROOMS.size,players:PLAYERS.length,version:BUILD_VERSION,gitCommit:process.env.RENDER_GIT_COMMIT||null});
    if(req.method==='POST'&&url.pathname==='/api/create'){const v=await body(req);return json(res,200,create(v.name,v.format,v.color));}
    if(req.method==='POST'&&url.pathname==='/api/join'){const v=await body(req);return json(res,200,join(v.code,v.name,v.color));}
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
