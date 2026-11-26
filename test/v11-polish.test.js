import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {possessionResolvedMs,timeoutControl,possessionWindow,TIMEOUT_DECISION_MS} from '../transition-rules.js';
const e={id:12,at:10000,offense:0,transition:{durationMs:1850},passDurationMs:1700,displayEvent:'three',made:true,jumperSetupMs:230};
test('timeout eligibility waits for the actual shot/rebound/turnover resolution, not precomputed next possession',()=>{
 const g={offense:1,event:e},play={at:10000};
 assert.equal(timeoutControl(g,play,3250).side,1);
 assert.equal(timeoutControl(g,play,3250).opensAt,10000+1850+1700+230+470);
 assert.ok(possessionWindow(e,3250)>=possessionResolvedMs(e)+TIMEOUT_DECISION_MS);
 const miss={...e,made:false,reboundId:'p1',rimBounces:3};
 assert.equal(possessionResolvedMs(miss),possessionResolvedMs(e)+540+260);
 assert.equal(possessionResolvedMs({...e,displayEvent:'interception'}),1850+1700+200);
 assert.equal(timeoutControl(g,play,3250,true),null);
 assert.equal(timeoutControl(g,{at:20000,readyForPossession:true},3250).opensAt,20000);
 assert.equal(timeoutControl(g,play,95).opensAt,10000);
});
test('poster and ankle banners have enough time before the next play',()=>{
 const p={...e,posterDunk:true};
 assert.ok(possessionWindow(p,3250)>=possessionResolvedMs(p)+1900);
 const a={...e,ankleBreaker:true};
 assert.ok(possessionWindow(a,3250)>=1850+1700+1900);
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/ANKLE_BANNER_MS=1900, POSTER_REACTIONS_MS=1900/);
 assert.ok(app.includes("ctx.fillText('ANKLE BREAKER!',W/2,topShotEffectY)"));
 assert.ok(app.includes("ctx.fillText('💪POSTER!💪',W/2,y)"));
});
test('bench detail controls are separate from placement buttons and show all stat categories',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(app.includes('p&&SLOTS.indexOf(s)>=5'));
 assert.ok(app.includes('bindBenchDetails(container)'));
 assert.ok(app.includes('weightedRows(p,true,{values,energy})'));
 assert.ok(app.includes('e.stopPropagation();showBenchDetails'));
 assert.ok(html.includes('<dialog id="bench-details-dialog"'));
});
