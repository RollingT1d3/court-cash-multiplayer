import test from 'node:test';
import assert from 'node:assert/strict';
import {modeRules,compactSlots,offerTrade,answerTrade,expireTrade,useGatorade} from '../advanced-v12.js';
function fixture(mode='advanced',sizes=[10,8]){
 return {mode,phase:'lineup',gameNumber:0,trade:null,tradeUsed:false,teams:sizes.map((n,i)=>{const roster=Array.from({length:n},(_,j)=>i+'p'+j);return {roster,slots:Object.fromEntries(modeRules(mode).slots.map((s,j)=>[s,roster[j]||null])),gatorades:modeRules(mode).gatorades,gatoradeAllocation:2,ready:true,energy:{}};})};
}
test('basic and advanced mode configuration',()=>{assert.deepEqual([modeRules().spins,modeRules().cap,modeRules().gatorades],[16,8,0]);assert.deepEqual([modeRules('advanced').spins,modeRules('advanced').cap,modeRules('advanced').gatorades],[18,10,2]);});
test('trade buffer, rejection, expiry, ownership and one accepted trade',()=>{
 const r=fixture(),offer={give:{players:['0p9','0p8'],gatorades:1},get:{players:['1p0'],gatorades:0}};
 assert.throws(()=>offerTrade(fixture('basic',[8,8]),0,offer,100,'x'),/Advanced/);
 assert.throws(()=>offerTrade(r,0,{give:{players:[],gatorades:0},get:{players:['1p0'],gatorades:0}},100,'bad'),/8–10/);
 assert.throws(()=>offerTrade(r,0,{give:{players:['1p0'],gatorades:0}},100,'bad'),/Invalid trade players/);
 const first=offerTrade(r,0,offer,100,'x');assert.equal(first.acceptAt,3100);assert.equal(first.expiresAt,33100);assert.ok(r.teams.every(t=>!t.ready));assert.throws(()=>answerTrade(r,1,{tradeId:'x',accept:true},3099),/buffer/);
 assert.throws(()=>answerTrade(r,0,{tradeId:'x',accept:true},3100),/recipient/);
 assert.equal(answerTrade(r,1,{tradeId:'x',accept:false},3100),false);assert.equal(r.tradeUsed,false);
 offerTrade(r,0,offer,4000,'y');assert.equal(expireTrade(r,36999),false);assert.equal(expireTrade(r,37000),true);assert.equal(r.tradeUsed,false);
 offerTrade(r,0,offer,30000,'z');assert.equal(answerTrade(r,1,{tradeId:'z',accept:true},62999),true);assert.deepEqual(r.teams.map(t=>t.roster.length),[9,9]);assert.deepEqual(r.teams.map(t=>t.gatorades),[1,3]);assert.equal(new Set(r.teams.flatMap(t=>t.roster)).size,18);
 for(const t of r.teams)assert.deepEqual(new Set(Object.values(t.slots).filter(Boolean)),new Set(t.roster));
 assert.throws(()=>offerTrade(r,0,offer,34000,'again'),/already been used/);
});
test('Gatorade only on caller timeout; cap at 100; consumption and stale timeout protection',()=>{
 const r=fixture();r.phase='timeout';r.timeout={caller:0,until:1000};r.game={fouledOut:[]};r.teams[0].energy['0p0']=95;r.teams[0].energy['0p1']=99;
 assert.throws(()=>useGatorade(r,1,'1p0',1000,10),/own current timeout/);
 assert.throws(()=>useGatorade(r,0,'0p0',999,10),/own current timeout/);
 assert.throws(()=>useGatorade(r,0,'1p0',1000,10),/eligible player/);
 assert.throws(()=>useGatorade(r,0,'0p2',1000,10),/full energy/);
 assert.equal(useGatorade(r,0,'0p0',1000,10),98);assert.equal(useGatorade(r,0,'0p1',1000,10),100);assert.equal(r.teams[0].gatorades,0);
 assert.throws(()=>useGatorade(r,0,'0p0',1000,10),/No Gatorades/);
});
