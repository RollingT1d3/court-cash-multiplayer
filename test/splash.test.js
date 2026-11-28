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
test('active room refresh bypasses splash; slow images do not begin the staggered fade prematurely',()=>{
 const room=setup({room:{code:'ABCDEF',token:'existing'}});assert.equal(room.ids['splash-screen'].hidden,true);assert.equal(room.ids.shell.inert,false);
 const {ids}=setup({loaded:false});assert.ok(!ids['splash-art'].classList.values.has('reveal'));
 for(const id of ['splash-base','splash-cast']){ids[id].complete=true;ids[id].naturalWidth=1675;ids[id].events.load();}
 assert.ok(ids['splash-art'].classList.values.has('reveal'));
});
test('missing art leaves a usable PLAY fallback; both actual WebP layers exist and CSS uses a 5.5-second reveal',()=>{
 const {ids}=setup({loaded:false});ids['splash-base'].complete=true;ids['splash-base'].events.error();assert.ok(ids['splash-art'].classList.values.has('fallback'));ids['splash-play'].events.click();assert.equal(ids.shell.inert,false);
 for(const file of ['splash-base','splash-full']){const b=read('public/images/'+file+'.webp');assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}
 const css=read('public/splash.css').toString(),html=read('public/index.html').toString();
 assert.match(css,/cast-complete 5500ms steps\(1,end\) both/);
 const timing=[...css.matchAll(/\.splash-([a-z-]+)\{--delay:(\d+)ms;--duration:(\d+)ms;clip-path:polygon\(/g)];
 assert.equal(timing.length,9);assert.ok(new Set(timing.map(x=>x[3])).size>1);
 assert.equal(Math.max(...timing.map(x=>Number(x[2])+Number(x[3]))),5500);
 for(const [,name] of timing)assert.ok(html.includes('class="splash-character splash-'+name+'"'));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(read('public/index.html').toString(),/id="splash-play"/);
});
