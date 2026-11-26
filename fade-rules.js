// Fadeaways are two-point jumpers, usually selected to escape a contest.
import {fadeTendency} from './shot-tendencies-v11.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const FADE_SETUP_MS=720;
export function fadeChance({type,quickBreak=false,ankleBreaker=false,fades=50,mid=75,post=75,iq=75,defense=75,heightGap=0,screen=false,shotClockRemaining=12,scheme=''}){
 if(quickBreak||ankleBreaker||!['mid','layup'].includes(type))return 0;
 const postFade=type==='layup';
 const skill=clamp(fades,0,100);
 const pressure=clamp((defense-70)*.004+Math.max(0,heightGap)*.008,0,.20);
 const preference=clamp((skill-(postFade?post:mid))*.003,-.09,.12);
 const tactical=scheme==='Paint Mash'&&postFade?.045:scheme==='Play Through Superstar'||scheme==='Pure Chaos'?.025:0;
 const willingness=(skill/100)**2;
 const base=postFade?.015:.035;
 const chance=base+Math.max(0,skill-60)*.004+pressure+preference+tactical+(iq-75)*.001+(shotClockRemaining<=5?.035:0)-(screen?.065:0);
 return clamp(chance*willingness*fadeTendency(skill),0,postFade?.34:.50);
}
export function fadeValue(fades,secondary){return .85*fades+.15*secondary;}
export function fadeContestRelief(fades){return clamp(.20+(fades-50)*.006,.08,.50);}
