import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Integer hundredths of one percent avoid floating-point total drift.
export function validateWeights(weights,players){
  if(!weights||typeof weights!=='object'||Array.isArray(weights))throw Error('Invalid probability settings.');
  const ids=players.map(p=>String(p.id));
  if(Object.keys(weights).length!==ids.length||ids.some(id=>!Object.hasOwn(weights,id)))throw Error('Backup must contain exactly the current player IDs.');
  const next=Object.create(null);
  let total=0,positive=0;
  for(const id of ids){
    const n=weights[id],units=Math.round(n*100);
    if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>100||Math.abs(n*100-units)>1e-7)throw Error('Use probabilities from 0 to 100 with at most two decimal places.');
    next[id]=units/100;total+=units;if(units>0)positive++;
  }
  if(total!==10000)throw Error('Wheel probabilities must total exactly 100%.');
  if(positive<16)throw Error('At least 16 players must have a positive probability.');
  return next;
}
// Complete historical 200- and 217-player backups remain usable. New IDs
// are initialized to zero; all other incomplete backups remain invalid.
export function expandLegacyWeights(weights,players){
  if(!weights||typeof weights!=='object'||Array.isArray(weights)||players.length<=200)return weights;
  const count=Object.keys(weights).length;
  if(![200,217].includes(count)||count>=players.length)return weights;
  const legacy=Array.from({length:count},(_,i)=>'p'+String(i+1).padStart(3,'0'));
  if(Object.keys(weights).length!==legacy.length||legacy.some(id=>!Object.hasOwn(weights,id)))return weights;
  const ids=new Set(players.map(p=>p.id));
  if(legacy.some(id=>!ids.has(id)))return weights;
  return Object.fromEntries(players.map(p=>[p.id,Object.hasOwn(weights,p.id)?weights[p.id]:0]));
}
export function createWheelStore({root,players,file=process.env.COURT_CASH_WEIGHTS_FILE||path.join(root,'data','wheel-probabilities.json'),preferPublishedDefaults=false}){
  const original=validateWeights(Object.fromEntries(players.map(p=>[p.id,p.weight])),players);
  // A newly published set of default odds supersedes earlier admin saves.
  // Saves made against this same published baseline survive restarts.
  const hashDefaults=weights=>createHash('sha256').update(JSON.stringify(Object.entries(weights).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
  const baseline=preferPublishedDefaults?hashDefaults(original):null;
  let current={...original};
  try{
    const saved=JSON.parse(readFileSync(file,'utf8'));
    if(saved.version!==1||saved.kind!=='court-cash-wheel-probabilities')throw Error('Unsupported probability backup.');
    const expanded=expandLegacyWeights(saved.weights,players);
    // Appending zero-weight players alone must not discard existing admin odds.
    const priorBaseline=expanded!==saved.weights&&players.every(p=>Object.hasOwn(saved.weights,p.id)||original[p.id]===0)
      ?hashDefaults(Object.fromEntries(Object.entries(original).filter(([id])=>Object.hasOwn(saved.weights,id)))):null;
    if(!baseline||saved.baseline===baseline||(priorBaseline&&saved.baseline===priorBaseline))current=validateWeights(expanded,players);
  }catch(error){if(error.code!=='ENOENT')console.error('Wheel probabilities not loaded:',error.message);}
  const backup=()=>({version:1,kind:'court-cash-wheel-probabilities',weights:{...current}});
  function save(data){
    if(data?.version!==1||data.kind!=='court-cash-wheel-probabilities')throw Error('Unsupported probability backup.');
    const next=validateWeights(expandLegacyWeights(data.weights,players),players);
    mkdirSync(path.dirname(file),{recursive:true});
    writeFileSync(file+'.tmp',JSON.stringify({version:1,kind:'court-cash-wheel-probabilities',weights:next,...(baseline?{baseline}:{})},null,2)+'\n',{mode:0o600});
    renameSync(file+'.tmp',file);current=next;
    return backup();
  }
  return Object.freeze({snapshot:()=>({...current}),original:()=>({...original}),backup,save});
}
export function selectWeighted(remaining,weights,random=Math.random){
  const eligible=remaining.filter(id=>weights[id]>0);
  const total=eligible.reduce((n,id)=>n+Math.round(weights[id]*100),0);
  if(total<=0)throw Error('No eligible players remain.');
  let mark=random()*total;
  for(const id of eligible){mark-=Math.round(weights[id]*100);if(mark<0)return id;}
  return eligible.at(-1);
}
