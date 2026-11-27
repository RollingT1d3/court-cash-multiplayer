import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
function setup({room=null,loaded=true}={}){
 const el=()=>({hidden:true,inert:false,complete:loaded,naturalWidth:loaded?1675:0,events:{},focused:false,classList:{values:new Set(),add(x){this.values.add(x)},remove(x){this.values.delete(x)}},addEventListener(k,f){this.events[k]=f},focus(){this.focused=true}});
 const ids=Object.fromEntries(['splash-screen','splash-art','splash-base','splash-cast','splash-play','shell','create-name'].map(k=>[k,el()]));
 const body=el();runInNewContext(read('public/splash.js').toString(),{document:{body,getElementById:k=>ids[k]},sessionStorage:{getItem:()=>JSON.stringify(room)}});
 return {ids,body};
}
test('splash opens on a fresh visit, fades artwork after load and PLAY exposes the existing menu',()=>{
 const {ids,body}=setup();assert.equal(ids['splash-screen'].hidden,false);assert.equal(ids.shell.inert,true);assert.ok(ids['splash-art'].classList.values.has('reveal'));
 ids['splash-play'].events.click();assert.equal(ids['splash-screen'].hidden,true);assert.equal(ids.shell.inert,false);assert.ok(!body.classList.values.has('splash-open'));assert.ok(ids['create-name'].focused);
});
test('active room refresh bypasses splash; slow images do not begin the three-second fade prematurely',()=>{
 const room=setup({room:{code:'ABCDEF',token:'existing'}});assert.equal(room.ids['splash-screen'].hidden,true);assert.equal(room.ids.shell.inert,false);
 const {ids}=setup({loaded:false});assert.ok(!ids['splash-art'].classList.values.has('reveal'));
 for(const id of ['splash-base','splash-cast']){ids[id].complete=true;ids[id].naturalWidth=1675;ids[id].events.load();}
 assert.ok(ids['splash-art'].classList.values.has('reveal'));
});
test('missing art leaves a usable PLAY fallback; both actual WebP layers exist and CSS uses three seconds',()=>{
 const {ids}=setup({loaded:false});ids['splash-base'].complete=true;ids['splash-base'].events.error();assert.ok(ids['splash-art'].classList.values.has('fallback'));ids['splash-play'].events.click();assert.equal(ids.shell.inert,false);
 for(const file of ['splash-base','splash-full']){const b=read('public/images/'+file+'.webp');assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}
 assert.match(read('public/splash.css').toString(),/cast-reveal 3000ms linear both/);
 assert.match(read('public/index.html').toString(),/id="splash-play"/);
});
