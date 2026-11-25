// Box-and-One: one dedicated chaser, two high zone defenders, two low.
export const BOX_AND_ONE = 'Box-and-One';
export const BOX_STAR_CONTEST = .13;
export const BOX_OTHER_THREE_OPEN = .055;
export const BOX_OTHER_MID_OPEN = .025;
export const BOX_PAINT_CONTEST = .025;
export const BOX_CHASER_FATIGUE = 1.25;
export const BOX_ANCHORS = Object.freeze([
  Object.freeze({x:.76,y:.33}),Object.freeze({x:.76,y:.67}),
  Object.freeze({x:.88,y:.33}),Object.freeze({x:.88,y:.67})
]);
function sorted(ids,score){return ids.slice().sort((a,b)=>score(b)-score(a));}
export function boxAssignments(attackers,defenders,overall,rating,offensePositions){
  const target=sorted(attackers,overall)[0];
  const chaser=sorted(defenders,id=>.65*rating(id,'perimeterDef')+.20*rating(id,'speed')+.15*rating(id,'iq'))[0];
  const rest=defenders.filter(id=>id!==chaser);
  const low=sorted(rest,id=>.65*rating(id,'paintDef')+.20*rating(id,'block')+.15*rating(id,'rebound')).slice(0,2);
  const high=rest.filter(id=>!low.includes(id));
  const positions=Object.fromEntries([...high,...low].map((id,i)=>[id,BOX_ANCHORS[i]]));
  const at=offensePositions[target]||{x:.66,y:.5};
  positions[chaser]={x:Math.min(.96,at.x+.045),y:at.y};
  return {target,chaser,high,low,positions};
}
export function boxShotDefenders(box,shooter,inPaint){
  return shooter===box.target?[box.chaser]:inPaint?box.low:box.high;
}
export function boxShotAdjustment(box,shooter,type){
  if(shooter===box.target)return BOX_STAR_CONTEST;
  return type==='three'?-BOX_OTHER_THREE_OPEN:type==='mid'?-BOX_OTHER_MID_OPEN:BOX_PAINT_CONTEST;
}
