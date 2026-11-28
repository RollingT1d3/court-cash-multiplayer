import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateWeights,selectWeighted,createWheelStore,expandLegacyWeights} from '../wheel-probabilities.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const prior=['data/players.json','data/players-3.json','data/players-4.json'].flatMap(p=>JSON.parse(read(p)));
const batch=JSON.parse(read('data/players-5.json')),all=[...prior,...batch];
const old=JSON.parse(read('test/fixtures/published-wheel-300.json')).weights;
test('Batch 5 adds nine approved portraits and stat sets; published wheel odds unchanged',()=>{
 assert.equal(prior.length,300);assert.equal(all.length,309);assert.equal(new Set(all.map(p=>p.id)).size,309);
 assert.deepEqual(batch.map(p=>p.id),Array.from({length:9},(_,i)=>'p'+(301+i)));
 assert.deepEqual(batch.map(p=>p.overall),[84,83,81,81,77,79,81,76,88]);
 for(const p of batch){assert.equal(p.weight,0);assert.deepEqual(Object.keys(p.stats).sort(),Object.keys(prior[0].stats).sort());assert.ok(Object.values(p.stats).every(v=>Number.isInteger(v)&&v>=0&&v<=100));assert.equal(p.image,'/images/'+p.id+'.webp');const b=read('public'+p.image);assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');assert.ok(p.courtPortrait.crop.width>0);}
 const w=validateWeights(Object.fromEntries(all.map(p=>[p.id,p.weight])),all);
 assert.deepEqual({...w},{...old,...Object.fromEntries(batch.map(p=>[p.id,0]))});
 assert.equal(all.filter(p=>p.weight>0).length,300);assert.equal(selectWeighted(all.map(p=>p.id),w,()=>.999999),'p300');
 assert.match(read('server.js').toString(),/data\/players-5\.json/);
});
test('saved 300-player admin weights survive expansion to 309; new players can be assigned odds',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'cc-batch5-'));
 try{const store=createWheelStore({root,players:prior,preferPublishedDefaults:true});const saved=store.snapshot();saved.p001=Math.round((saved.p001-.01)*100)/100;saved.p002=Math.round((saved.p002+.01)*100)/100;store.save({version:1,kind:'court-cash-wheel-probabilities',weights:saved});
 const next=createWheelStore({root,players:all,preferPublishedDefaults:true});const expected={...saved,...Object.fromEntries(batch.map(p=>[p.id,0]))};assert.deepEqual(next.snapshot(),expected);assert.deepEqual(next.save({version:1,kind:'court-cash-wheel-probabilities',weights:saved}).weights,expected);
 const edit={...expected,p001:Math.round((expected.p001-.01)*100)/100,p309:.01};assert.equal(next.save({version:1,kind:'court-cash-wheel-probabilities',weights:edit}).weights.p309,.01);assert.deepEqual(createWheelStore({root,players:all,preferPublishedDefaults:true}).snapshot(),edit);
 const incomplete={...expected};delete incomplete.p309;assert.throws(()=>validateWeights(expandLegacyWeights(incomplete,all),all),/exactly/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
