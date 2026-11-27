import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const browser={};runInNewContext(read('public/court-audio.js'),{window:browser});
const {menuLoop,createEngine}=browser.CourtCashAudio;
const buffer=(channels,n,sr)=>{const d=new Float32Array(n);return {length:n,sampleRate:sr,getChannelData:()=>d};};
test('original lounge track has a 40-second loop, valid samples and click-free edges',()=>{
 const b=menuLoop({createBuffer:buffer}),d=b.getChannelData(0);assert.equal(b.length/b.sampleRate,40);
 let peak=0;for(const x of d){assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));}
 assert.ok(peak>.08&&peak<1);assert.equal(Math.abs(d[0]),0);assert.equal(Math.abs(d.at(-1)),0);
});
test('music uses one loop across splash and menu, fades in rooms, follows master mute and volume',()=>{
 const gains=[],sources=[],prefs=new Map();
 const makeGain=()=>{const gain={value:0,setTargetAtTime(v){this.value=v}};const node={gain,connect(){}};gains.push(node);return node;};
 class Audio{constructor(){this.sampleRate=22050;this.currentTime=0;this.state='running';this.destination={};}createGain(){return makeGain();}createBuffer(...a){return buffer(...a);}createBufferSource(){const s={connect(){},start(){this.started=true}};sources.push(s);return s;}}
 const e=createEngine({AudioContext:Audio,localStorage:{getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)},clearTimeout(){}});
 e.setMenuMusic(true);e.unlock();assert.equal(sources.length,1);assert.ok(sources[0].loop&&sources[0].started);assert.equal(gains[1].gain.value,.38);
 e.unlock();e.setMenuMusic(true);assert.equal(sources.length,1);e.setMenuMusic(false);assert.equal(gains[1].gain.value,0);e.setMenuMusic(true);assert.equal(gains[1].gain.value,.38);assert.equal(sources.length,1);
 e.setMuted(true);assert.equal(gains[0].gain.value,0);e.setMuted(false);e.setVolume(.5);assert.equal(gains[0].gain.value,.325);
 const app=read('public/app.js');assert.match(app,/function connect\(\)\{\s*audio\?\.setMenuMusic\(false\)/);assert.match(app,/if\(!identity\)\{audio\?\.setMenuMusic\(true\);audio\?\.unlock\(\);\}/);
});
