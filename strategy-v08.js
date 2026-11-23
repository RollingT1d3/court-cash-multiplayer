// COURT CASH v0.8 — authored, testable strategy decisions and lane geometry.
export const PLAY_THROUGH_POINT = 'Play Through Point';
export const CLOG_THE_LANES = 'Clog The Lanes';
// Tunable balance values where the design intentionally did not supply exact odds.
export const CLOG_INTERCEPTION_FACTOR = 2.5;
export const CLOG_PAINT_SHOT_BONUS = .11;
export const CLOG_PAINT_REBOUND_BONUS = .055;
export const CLOG_BLOCK_FACTOR = .45;
const clamp = (v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

export function pointRoles(active, getStat){
  if(!Array.isArray(active)||active.length!==5||active.some(x=>!x))throw Error('Point strategy requires five active players');
  const pg=active[0],center=active[4];
  const wings=active.slice(1,4);
  const corners=wings.slice().sort((a,b)=>getStat(b,'three')-getStat(a,'three')||wings.indexOf(a)-wings.indexOf(b)).slice(0,2);
  const bestInside=Math.max(getStat(center,'dunk'),getStat(center,'layup'),getStat(center,'post'));
  const bestOutside=Math.max(getStat(center,'three'),getStat(center,'mid'));
  const centerPreference=bestOutside>bestInside?'pop':'roll';
  return {pg,center,wings,corners,centerPreference};
}

export function pointPlay(active,getStat,random=Math.random){
  const roles=pointRoles(active,getStat);
  const {pg,center,corners,centerPreference}=roles;
  const choice=Math.floor(random()*2);
  const roll=random();
  const targets={
    [pg]:{x:.69,y:.50},[center]:{x:.83,y:.53},
    [corners[0]]:{x:.70,y:.12},[corners[1]]:{x:.70,y:.88}
  };
  const third=roles.wings.find(id=>!corners.includes(id));
  targets[third]={x:.79,y:.39};
  let action,shooter,passer=null,range,screen=false,wingCut=null,cutReturned=false;
  if(roll<.28){
    action='pg-kickout';shooter=corners[choice];passer=pg;range='three';screen=true;
  }else if(roll<.48){
    action='pg-drive';shooter=pg;range='paint';screen=true;
  }else if(roll<.66){
    action='center-direct';shooter=center;range='paint';targets[center]={x:.89,y:.5};
  }else if(roll<.84){
    action=centerPreference==='pop'?'center-pop':'center-roll';shooter=center;passer=pg;screen=true;
    range=centerPreference==='roll'?'paint':getStat(center,'three')>=getStat(center,'mid')?'three':'mid';
    targets[center]=range==='paint'?{x:.88,y:.57}:{x:.71,y:.63};
  }else{
    wingCut=corners[choice];screen=true;
    const received=random()<.66;
    cutReturned=!received;
    if(received){action='wing-cut';shooter=wingCut;passer=pg;range='paint';targets[wingCut]={x:.89,y:.44};}
    else {action='wing-return';shooter=pg;range='paint';targets[wingCut]={x:.70,y:choice===0?.12:.88};}
  }
  return {...roles,action,shooter,passer,range,screen,targets,wingCut,cutReturned};
}

export function clogPositions(from,to,defenders){
  // Three defenders deliberately shadow the pass path; two track from the
  // wing/side, not from the painted area. Positions are per-possession.
  const fallbackFrom={x:.61,y:.5},fallbackTo={x:.84,y:.5};
  const a=from||fallbackFrom,b=to||fallbackTo;
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx*940,dy*525)||1;
  const nx=-(dy*525)/len/940,ny=(dx*940)/len/525;
  const ts=[.24,.46,.68];
  const result={};
  for(let i=0;i<defenders.length;i++){
    if(i<3){
      const offset=i%2?.012:-.012;
      result[defenders[i]]={x:clamp(a.x+dx*ts[i]+nx*offset,.12,.82),y:clamp(a.y+dy*ts[i]+ny*offset,.1,.9)};
    }else result[defenders[i]]={x:i===3?.68:.76,y:i===3?.18:.82};
  }
  return result;
}
export function clogInterceptionChance(base,passing){
  // Always preserve the established ≥90 Passing absolute immunity.
  if(passing>=90)return 0;
  return clamp(base*CLOG_INTERCEPTION_FACTOR);
}
