import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWeights,selectWeighted} from '../wheel-probabilities.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
test('all 50 approved expansion players have game-ready art and valid stats; combined odds remain at 100%',()=>{
 const original=JSON.parse(read('data/players.json'));
 const expansion=JSON.parse(read('data/players-3.json'));
 assert.equal(original.length,200);assert.equal(expansion.length,50);
 assert.deepEqual(expansion.map(p=>p.id),Array.from({length:50},(_,i)=>'p'+(201+i)));
 assert.deepEqual(expansion.map(p=>p.overall),[84,79,81,80,84,80,80,78,79,83,88,84,79,83,79,78,78,92,79,77,80,83,81,82,77,82,83,79,81,84,83,86,80,98,82,79,78,74,79,82,81,82,90,78,77,86,79,79,79,75]);
 const all=[...original,...expansion];
 assert.equal(new Set(all.map(p=>p.id)).size,250);
 for(const p of expansion){
   assert.ok(p.weight>=0);
   assert.deepEqual(Object.keys(p.stats).sort(),Object.keys(original[0].stats).sort());
   assert.ok(Object.values(p.stats).every(n=>Number.isInteger(n)&&n>=0&&n<=100));
   assert.equal(p.image,'/images/'+p.id+'.webp');
   const b=read('public'+p.image);
   assert.equal(b.subarray(0,4).toString(),'RIFF');
   assert.equal(b.subarray(8,12).toString(),'WEBP');
   assert.ok(p.courtPortrait.crop.width>0);
 }
 const weights=validateWeights(Object.fromEntries(all.map(p=>[p.id,p.weight])),all);
 assert.deepEqual(expansion.slice(0,17).map(p=>p.weight),[.2,.3,.2,.2,.2,.15,.15,.2,.2,.1,.2,.2,.15,.15,.15,.1,.05]);
 assert.ok(expansion.slice(17).every(p=>p.weight===0));
 assert.equal(all.filter(p=>p.weight>0).length,217);
 assert.equal(expansion.reduce((n,p)=>n+Math.round(p.weight*100),0),290);
 assert.equal(selectWeighted(all.map(p=>p.id),weights,()=>.999999),'p217');
 assert.match(read('server.js').toString(),/data\/players-3\.json/);
});
