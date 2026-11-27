import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWeights,selectWeighted} from '../wheel-probabilities.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
test('all 68 approved expansion players have game-ready art and valid stats; combined odds remain at 100%',()=>{
 const original=JSON.parse(read('data/players.json'));
 const expansion=JSON.parse(read('data/players-3.json'));
 assert.equal(original.length,200);assert.equal(expansion.length,68);
 assert.deepEqual(expansion.map(p=>p.id),Array.from({length:68},(_,i)=>'p'+(201+i)));
 assert.deepEqual(expansion.map(p=>p.overall),[84,79,81,80,84,80,80,78,79,83,88,84,79,83,79,78,78,92,79,77,80,83,81,82,77,82,83,79,81,84,83,86,80,98,82,79,78,74,79,82,81,82,90,78,77,86,79,79,79,75,81,82,78,84,85,83,79,84,79,87,77,83,83,84,82,74,80,87]);
 const all=[...original,...expansion];
 assert.equal(new Set(all.map(p=>p.id)).size,268);
 for(const p of expansion){
   assert.ok(p.weight>0);
   assert.deepEqual(Object.keys(p.stats).sort(),Object.keys(original[0].stats).sort());
   assert.ok(Object.values(p.stats).every(n=>Number.isInteger(n)&&n>=0&&n<=100));
   assert.equal(p.image,'/images/'+p.id+'.webp');
   const b=read('public'+p.image);
   assert.equal(b.subarray(0,4).toString(),'RIFF');
   assert.equal(b.subarray(8,12).toString(),'WEBP');
   assert.ok(p.courtPortrait.crop.width>0);
 }
 const weights=validateWeights(Object.fromEntries(all.map(p=>[p.id,p.weight])),all);
 assert.equal(all.filter(p=>p.weight>0).length,268);
 assert.equal(expansion.slice(50).length,18);
 assert.deepEqual(all.map(p=>p.weight),[0.4,0.4,1.5,0.7,0.12,0.3,0.2,0.7,0.5,0.2,0.5,0.15,0.2,0.6,0.14,0.12,0.2,0.8,0.1,0.17,0.4,0.2,0.5,0.25,0.15,0.4,0.5,0.5,0.3,0.4,0.2,0.2,0.2,0.3,0.3,0.2,0.2,0.4,0.2,0.21,0.5,1.5,0.2,0.4,0.25,0.8,0.3,0.2,0.34,0.2,0.15,1,0.5,0.15,0.5,0.4,0.8,0.3,0.2,0.3,0.2,0.5,0.07,0.3,0.5,0.2,0.2,1,0.5,0.3,0.5,0.5,0.4,0.5,0.2,0.7,0.15,0.4,0.15,0.3,0.8,0.25,0.6,0.4,0.2,0.3,0.3,0.7,0.8,0.45,0.2,0.5,0.71,0.5,0.5,0.5,0.5,0.4,0.7,0.3,1.1,0.45,0.3,0.25,0.5,0.2,0.2,0.4,0.2,0.55,0.3,0.5,0.4,0.5,0.4,0.5,0.7,1,0.4,0.3,0.2,0.3,0.1,0.5,1,0.3,0.3,0.4,0.7,0.75,0.3,0.5,0.5,0.3,0.3,1,0.2,0.4,0.25,0.4,0.9,0.12,0.4,0.7,0.8,0.3,0.3,0.5,0.15,0.3,0.5,0.3,0.3,0.1,0.3,0.4,0.3,0.35,0.2,0.5,0.5,0.5,0.7,0.8,0.75,0.3,0.2,0.25,0.35,0.75,0.9,0.1,0.3,0.75,0.3,0.4,0.4,0.3,0.8,0.5,0.4,0.4,0.7,0.5,0.55,0.15,0.2,0.4,0.5,0.3,0.3,0.4,0.4,0.5,0.2,0.5,1,0.3,0.3,0.4,0.3,0.3,0.4,0.2,0.2,0.35,0.25,0.2,0.2,0.3,0.2,0.3,0.15,0.25,0.15,0.1,0.05,0.15,0.3,0.25,0.45,0.2,0.2,0.2,0.25,0.15,0.2,0.2,0.2,0.2,0.5,0.25,0.4,0.15,0.25,0.15,0.25,0.05,0.2,0.3,0.2,0.2,0.2,0.05,0.15,0.2,0.1,0.1,0.1,0.1,0.25,0.35,0.3,0.25,0.2,0.3,0.25,0.4,0.25,0.2,0.3,0.4,0.3,0.3,0.4,0.1,0.4,0.3]);
 assert.equal(expansion.reduce((n,p)=>n+Math.round(p.weight*100),0),1600);
 assert.equal(selectWeighted(all.map(p=>p.id),weights,()=>.999999),'p268');
 assert.match(read('server.js').toString(),/data\/players-3\.json/);
});
