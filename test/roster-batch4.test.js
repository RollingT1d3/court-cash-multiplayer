import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateWeights,selectWeighted,createWheelStore} from '../wheel-probabilities.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const approved=JSON.parse(read('test/fixtures/published-wheel-300.json')).weights;
const historical=players=>players.map(p=>({...p,weight:approved[p.id]}));
const prior=historical([...JSON.parse(read('data/players.json')),...JSON.parse(read('data/players-3.json'))]);
const batch=historical(JSON.parse(read('data/players-4.json')));
const all=[...prior,...batch];
const crops=JSON.parse(read('test/fixtures/published-crops-batch4.json')).overrides;
const legacy=JSON.parse(read('test/fixtures/legacy-wheel-268.json'));
const historicPrior=prior.map(p=>({...p,weight:legacy[p.id]}));
const historicAll=[...historicPrior,...batch.map(p=>({...p,weight:0}))];
test('300 approved players; Batch 4 has all attributes and portraits and exact published odds',()=>{
 assert.equal(prior.length,268); assert.equal(batch.length,32); assert.equal(new Set(all.map(p=>p.id)).size,300);
 assert.deepEqual(batch.map(p=>p.id),Array.from({length:32},(_,i)=>'p'+(269+i)));
 assert.deepEqual(batch.map(p=>p.overall),[84,84,84,78,83,81,81,83,81,78,77,82,79,80,83,83,80,78,82,81,81,77,91,83,79,77,79,79,81,82,77,85]);
 for(const p of batch){assert.equal(p.weight,approved[p.id]);assert.deepEqual(Object.keys(p.stats).sort(),Object.keys(prior[0].stats).sort());assert.ok(Object.values(p.stats).every(v=>Number.isInteger(v)&&v>=0&&v<=100));assert.equal(p.image,'/images/'+p.id+'.webp');const b=read('public'+p.image);assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');assert.ok(p.courtPortrait.crop.width>0);}
 const w=validateWeights(Object.fromEntries(all.map(p=>[p.id,p.weight])),all);assert.equal(all.filter(p=>p.weight>0).length,300);assert.deepEqual({...w},approved);assert.equal(batch.reduce((n,p)=>n+Math.round(p.weight*100),0),795);assert.equal(batch.find(p=>p.id==='p284').name,'Chris Bash');for(const [id,crop] of Object.entries(crops))assert.deepEqual(batch.find(p=>p.id===id).courtPortrait.crop,crop);assert.equal(selectWeighted(all.map(p=>p.id),w,()=>.999999),'p300');assert.match(read('server.js').toString(),/data\/players-4\.json/);
});
test('268-player admin backup survives expansion to 300 without changing existing weights',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'cc-batch4-'));
 try{const store=createWheelStore({root,players:historicPrior,preferPublishedDefaults:true});const old=store.snapshot();old.p001=Math.round((old.p001-.01)*100)/100;old.p002=Math.round((old.p002+.01)*100)/100;store.save({version:1,kind:'court-cash-wheel-probabilities',weights:old});const next=createWheelStore({root,players:historicAll,preferPublishedDefaults:true});const expected={...old,...Object.fromEntries(batch.map(p=>[p.id,0]))};assert.deepEqual(next.snapshot(),expected);assert.deepEqual(next.save({version:1,kind:'court-cash-wheel-probabilities',weights:old}).weights,expected);const edited={...expected,p001:Math.round((expected.p001-.01)*100)/100,p300:.01};assert.equal(next.save({version:1,kind:'court-cash-wheel-probabilities',weights:edited}).weights.p300,.01);}
 finally{rmSync(root,{recursive:true,force:true});}
});

test('new published 300-player odds replace stale 268-player saves, preserving subsequent edits',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'cc-batch4-published-'));
 try{const old=createWheelStore({root,players:historicPrior,preferPublishedDefaults:true});const edit=old.snapshot();edit.p001=Math.round((edit.p001-.01)*100)/100;edit.p002=Math.round((edit.p002+.01)*100)/100;old.save({version:1,kind:'court-cash-wheel-probabilities',weights:edit});const next=createWheelStore({root,players:all,preferPublishedDefaults:true});assert.deepEqual(next.snapshot(),approved);const changed={...approved,p001:.39,p002:.41};next.save({version:1,kind:'court-cash-wheel-probabilities',weights:changed});assert.deepEqual(createWheelStore({root,players:all,preferPublishedDefaults:true}).snapshot(),changed);}
 finally{rmSync(root,{recursive:true,force:true});}
});
