import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const browser={};
runInNewContext(read('public/court-audio.js'),{window:browser});
const {plan,settings,createEngine,names}=browser.CourtCashAudio;
const s=(phase,extra={})=>({code:'A',phase,serverTime:1000,gameNumber:1,spinIndex:1,players:[{id:'p',overall:95}],...extra});
const cues=(a,b)=>Array.from(plan(a,b),x=>x.name);
test('audio cues are event-based, never replay first snapshot or duplicate updates',()=>{
  const w=s('wheel',{wheel:{spinId:1,until:3600}});
  assert.equal(plan(null,w).length,0);
  assert.ok(plan(s('coinflip'),w).length>10);
  assert.ok(plan(s('coinflip'),w).every(x=>x.name==='tick'&&x.delay<2600));
  assert.equal(plan(w,w).length,0);
  for(const [ovr,name] of [[95,'star'],[69,'poop'],[85,'reveal']]){
    const a=s('auction',{players:[{id:'p',overall:ovr}],auction:{playerId:'p',bid:100}});
    assert.deepEqual(cues(w,a),[name,'bid']);
    assert.deepEqual(cues(a,a),[]);
    assert.deepEqual(cues(a,{...a,auction:{...a.auction,bid:150}}),['bid']);
    const won=s('placement',{pending:{playerId:'p'}});
    assert.deepEqual(cues(a,won),['won']);
    assert.deepEqual(cues(won,won),[]);
  }
  assert.deepEqual(cues(w,{...w,code:'B'}),[]);
});
test('court cues distinguish made shots, misses, dunks, fouls, ankle breaks and quarter/match endings',()=>{
  const prev=s('sim',{game:{quarter:1,event:{id:1}}});
  const event=(extra={})=>s('sim',{game:{quarter:1,event:{id:2,at:1000,passDurationMs:0,...extra}}});
  assert.deepEqual(cues(prev,event({made:true,type:'mid'})),['bounce','swish']);
  assert.deepEqual(cues(prev,event({made:true,type:'dunk'})),['bounce','dunk']);
  assert.deepEqual(cues(prev,event({made:false,displayEvent:'miss'})),['bounce','rim']);
  assert.deepEqual(cues(prev,event({foul:true,displayEvent:'shooting-foul'})),['whistle']);
  assert.deepEqual(cues(prev,event({illegalScreen:true,displayEvent:'illegal-screen'})),['whistle']);
  assert.deepEqual(cues(prev,event({displayEvent:'steal'})),[]);
  assert.ok(cues(prev,event({ankleBreaker:true,made:true,type:'three'})).includes('reaction'));
  assert.deepEqual(cues(prev,{...prev,game:{...prev.game,quarter:2}}),['buzzer']);
  assert.deepEqual(cues(prev,{...prev,phase:'finished',result:{forfeit:false}}),['buzzer','cheer']);
  assert.deepEqual(cues(prev,{...prev,phase:'finished',result:{forfeit:true}}),[]);
  assert.deepEqual(cues(prev,{...event({made:true}),serverTime:5000}),[]);
});
test('master settings persist, clamp and survive blocked storage or unavailable audio',()=>{
  const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  const engine=createEngine({localStorage:storage});
  assert.equal(engine.getSettings().volume,.45);
  engine.setVolume(2);engine.setMuted(true);
  assert.equal(settings(storage).volume,1);assert.equal(settings(storage).muted,true);
  engine.unlock();engine.observe(s('wheel'));engine.reset();
  assert.equal(settings({getItem(){throw Error('blocked');}}).volume,.45);
  assert.equal(names.length,14);
});
test('sound helper loads before app and controls stay outside room-specific views',()=>{
  const html=read('public/index.html'),app=read('public/app.js');
  assert.ok(html.indexOf('/court-audio.js')<html.indexOf('/app.js'));
  assert.ok(html.indexOf('id="sound-volume"')<html.indexOf('id="welcome"'));
  assert.match(app,/audio\?\.observe\(state\)/);
  assert.match(app,/audio\?\.reset\(\)/);
});
