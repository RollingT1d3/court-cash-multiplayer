import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createWheelStore,validateWeights,selectWeighted} from '../wheel-probabilities.js';
import {createAdminAPI} from '../admin-v09.js';
const players=Array.from({length:20},(_,i)=>({id:'p'+i,name:'Player '+i,overall:80,weight:5}));
const defaults=Object.fromEntries(players.map(p=>[p.id,p.weight]));
const data=weights=>({version:1,kind:'court-cash-wheel-probabilities',weights});
test('exact totals, precision, complete IDs and enough eligible players are mandatory',()=>{
  assert.deepEqual({...validateWeights(defaults,players)},defaults);
  assert.throws(()=>validateWeights({...defaults,p0:4.99},players),/100%/);
  assert.throws(()=>validateWeights({...defaults,p0:5.001},players),/decimal/);
  assert.throws(()=>validateWeights({...defaults,p0:-1},players),/0 to 100/);
  assert.throws(()=>validateWeights({...defaults,p0:'5'},players),/0 to 100/);
  assert.throws(()=>validateWeights({...defaults,extra:0},players),/player IDs/);
  assert.throws(()=>validateWeights(Object.fromEntries(players.map((p,i)=>[p.id,i===0?100:0])),players),/16 players/);
});
test('save is persistent, original defaults are immutable, existing snapshots stay unchanged and zero weights cannot win',()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'cc-wheel-'));
  try{
    const store=createWheelStore({root,players});
    const old=store.snapshot();
    const next={...defaults,p0:0,p1:10};
    store.save(data(next));
    assert.equal(old.p0,5);assert.equal(store.snapshot().p0,0);
    assert.equal(store.original().p0,5);assert.equal(players[0].weight,5);
    assert.equal(selectWeighted(['p0','p1'],store.snapshot(),()=>0),'p1');
    assert.throws(()=>selectWeighted(['p0'],store.snapshot()),/No eligible/);
    assert.throws(()=>store.save(data({...next,p1:11})),/100%/);
    assert.deepEqual(store.snapshot(),next);
    const again=createWheelStore({root,players});
    assert.deepEqual(again.backup(),data(next));
    again.save(data(again.original()));assert.deepEqual(again.snapshot(),defaults);
  }finally{rmSync(root,{recursive:true,force:true});}
});
async function call(api,route,method='GET',data,token){
  const req=Readable.from([Buffer.from(data===undefined?'':JSON.stringify(data))]);
  req.method=method;req.socket={remoteAddress:'127.0.0.1'};req.headers=token?{authorization:'Bearer '+token}:{};
  const res={writeHead(code){this.status=code;},end(s){this.body=JSON.parse(s);}};
  assert.equal(await api(req,res,new URL(route,'http://localhost')),true);return res;
}
test('wheel admin requires authentication; exports exact saved settings separately from portrait backups',async()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'cc-wheel-api-'));
  try{
    const wheelStore=createWheelStore({root,players});
    const api=createAdminAPI({root,players,wheelStore});
    assert.equal((await call(api,'/api/admin/wheel')).status,401);
    assert.equal((await call(api,'/api/admin/wheel','POST',data(defaults))).status,401);
    const token=(await call(api,'/api/admin/login','POST',{pin:process.env.COURT_CASH_ADMIN_CODE||'8371'})).body.token;
    const initial=await call(api,'/api/admin/wheel','GET',undefined,token);
    assert.deepEqual(initial.body.original,defaults);
    const changed={...defaults,p0:0,p1:10};
    assert.equal((await call(api,'/api/admin/wheel','POST',data(changed),token)).status,200);
    assert.equal((await call(api,'/api/admin/wheel','POST',data({...changed,p1:9}),token)).status,400);
    assert.deepEqual((await call(api,'/api/admin/wheel/export','GET',undefined,token)).body,data(changed));
    assert.deepEqual((await call(api,'/api/admin/export','GET',undefined,token)).body,{version:1,overrides:{}});
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('server and wheel display both use room-specific weights rather than mutable defaults',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(server,/const weights=wheelStore\.snapshot\(\)/);
  assert.match(server,/remaining:PLAYERS\.filter\(p=>weights\[p\.id\]>0\)/);
  assert.match(server,/weight:room\.weights\[p\.id\]/);
  assert.match(server,/selectWeighted\(room\.remaining,room\.weights,rnd\)/);
  assert.match(app,/filter\(p=>p&&p\.weight>0\)/);
  assert.match(html,/id="admin-tab-wheel"/);
});

test('legacy 200-player backups preserve all original probabilities and add expansion players at zero',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'cc-wheel-expansion-'));
 try{
  const original=JSON.parse(readFileSync(new URL('../data/players.json',import.meta.url),'utf8'));
  const expansion=JSON.parse(readFileSync(new URL('../data/players-3.json',import.meta.url),'utf8'));
  const combined=[...original,...expansion];
  const old=Object.fromEntries(original.map(p=>[p.id,p.weight]));
  const positive=original.filter(p=>p.weight>=.01);
  // Build a valid pre-expansion backup independent of current published odds.
  const missing=10000-Object.values(old).reduce((n,v)=>n+Math.round(v*100),0);
  old[positive[0].id]=Math.round(old[positive[0].id]*100+missing)/100;
  old[positive[0].id]=Math.round((old[positive[0].id]-.01)*100)/100;
  old[positive[1].id]=Math.round((old[positive[1].id]+.01)*100)/100;
  mkdirSync(path.join(root,'data'));
  writeFileSync(path.join(root,'data','wheel-probabilities.json'),JSON.stringify(data(old)));
  const store=createWheelStore({root,players:combined});
  const expected={...old,...Object.fromEntries(expansion.map(p=>[p.id,0]))};
  assert.deepEqual(store.snapshot(),expected);
  assert.deepEqual(store.save(data(old)).weights,expected);
  const bad={...old};delete bad.p001;bad.unknown=0;
  assert.throws(()=>store.save(data(bad)),/player IDs/);
  const changed={...expected,p201:.01};changed[positive[1].id]=Math.round((changed[positive[1].id]-.01)*100)/100;
  assert.equal(store.save(data(changed)).weights.p201,.01);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('published probability updates supersede stale saved settings but preserve subsequent admin edits',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'cc-wheel-baseline-'));
 try{
  const first=createWheelStore({root,players});
  const stale={...defaults,p0:4,p1:6};
  first.save(data(stale));
  const published=createWheelStore({root,players,preferPublishedDefaults:true});
  assert.deepEqual(published.snapshot(),defaults);
  const edited={...defaults,p0:3,p1:7};
  published.save(data(edited));
  assert.deepEqual(createWheelStore({root,players,preferPublishedDefaults:true}).snapshot(),edited);
  assert.deepEqual(published.backup(),data(edited));
  const changed=players.map(p=>({...p,weight:p.id==='p0'?2:p.id==='p1'?8:p.weight}));
  assert.deepEqual(createWheelStore({root,players:changed,preferPublishedDefaults:true}).snapshot(),Object.fromEntries(changed.map(p=>[p.id,p.weight])));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('217-player admin backups survive a zero-weight roster expansion without changing odds',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'cc-wheel-batch2-'));
 try{
  const original=JSON.parse(readFileSync(new URL('../data/players.json',import.meta.url),'utf8'));
  const expansion=JSON.parse(readFileSync(new URL('../data/players-3.json',import.meta.url),'utf8'));
  // Reconstruct a valid zero-weight expansion fixture independently of published odds.
  const oldPlayers=[...original,...expansion.slice(0,17)].map(p=>({...p}));
  const missing=10000-oldPlayers.reduce((n,p)=>n+Math.round(p.weight*100),0);
  oldPlayers[0].weight=(Math.round(oldPlayers[0].weight*100)+missing)/100;
  const combined=[...oldPlayers,...expansion.slice(17).map(p=>({...p,weight:0}))];
  const store=createWheelStore({root,players:oldPlayers,preferPublishedDefaults:true});
  const old=store.snapshot();old.p201=.19;old.p202=.31;store.save(data(old));
  const next=createWheelStore({root,players:combined,preferPublishedDefaults:true});
  const expected={...old,...Object.fromEntries(expansion.slice(17).map(p=>[p.id,0]))};
  assert.deepEqual(next.snapshot(),expected);
  assert.deepEqual(next.save(data(old)).weights,expected);
  assert.equal(selectWeighted(combined.map(p=>p.id),next.snapshot(),()=>.999999),'p217');
  const published=[...original,...expansion];
  const rebalanced=createWheelStore({root,players:published,preferPublishedDefaults:true});
  assert.deepEqual(rebalanced.snapshot(),Object.fromEntries(published.map(p=>[p.id,p.weight])));
  assert.equal(selectWeighted(published.map(p=>p.id),rebalanced.snapshot(),()=>.999999),'p250');
 }finally{rmSync(root,{recursive:true,force:true});}
});
