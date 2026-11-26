import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWeights,selectWeighted} from '../wheel-probabilities.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
test('all 17 approved expansion players have game-ready art and valid stats; original odds remain at 100%',()=>{
 const original=JSON.parse(read('data/players.json'));
 const expansion=JSON.parse(read('data/players-3.json'));
 assert.equal(original.length,200);assert.equal(expansion.length,17);
 assert.deepEqual(expansion.map(p=>p.id),Array.from({length:17},(_,i)=>'p'+(201+i)));
 assert.deepEqual(expansion.map(p=>p.overall),[84,79,81,80,84,80,80,78,79,83,88,84,79,83,79,78,78]);
 const all=[...original,...expansion];
 assert.equal(new Set(all.map(p=>p.id)).size,217);
 for(const p of expansion){
   assert.equal(p.weight,0);
   assert.deepEqual(Object.keys(p.stats).sort(),Object.keys(original[0].stats).sort());
   assert.ok(Object.values(p.stats).every(n=>Number.isInteger(n)&&n>=0&&n<=100));
   assert.equal(p.image,'/images/'+p.id+'.webp');
   const b=read('public'+p.image);
   assert.equal(b.subarray(0,4).toString(),'RIFF');
   assert.equal(b.subarray(8,12).toString(),'WEBP');
   assert.ok(p.courtPortrait.crop.width>0);
 }
 const weights=validateWeights(Object.fromEntries(all.map(p=>[p.id,p.weight])),all);
 for(const roll of [0,.1,.5,.999999])assert.ok(original.some(p=>p.id===selectWeighted(all.map(p=>p.id),weights,()=>roll)));
 assert.match(read('server.js').toString(),/data\/players-3\.json/);
});
