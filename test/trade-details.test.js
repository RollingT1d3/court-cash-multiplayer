import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js'),html=read('public/index.html');
test('trade detail buttons appear for all players in builder and both sides of a pending offer',()=>{
 const p={id:'p1',name:'First Player',overall:80,positions:['PG'],heightInches:72,archetype:'Playmaker',stats:{}},q={...p,id:'p2',name:'Second Player'};
 const state={code:'TEST',you:0,phase:'lineup',mode:'advanced',teams:[{name:'A',roster:['p1'],gatorades:2},{name:'B',roster:['p2'],gatorades:2}]};
 const source=app.slice(app.indexOf('  let tradeDraft='),app.indexOf('  function bindTrade()'));
 const make=new Function('state','player','esc','my','$',source+'\nreturn tradeMarkup;');
 const markup=make(state,id=>id==='p1'?p:q,String,()=>state.teams[0],()=>({addEventListener(){}}));
 for(const view of [undefined,{from:0,give:{players:['p1'],gatorades:1},get:{players:['p2'],gatorades:0}},{from:1,give:{players:['p2'],gatorades:0},get:{players:['p1'],gatorades:0}}]){
  state.trade=view;const out=markup();for(const id of ['p1','p2'])assert.ok(out.includes('data-trade-details="'+id+'"'));
  if(!view)assert.equal((out.match(/data-trade-side=/g)||[]).length,2);
 }
 assert.match(app,/weightedRows\(p,true\)/);assert.match(html,/id="trade-details-dialog"/);assert.match(app,/panel.querySelectorAll\('\[data-trade-details\]'\)/);
});
test('countdown updates both trade panel and details dialog, without changing the deadline',()=>{
 const labels=[{classList:{toggle(){}}},{classList:{toggle(){}}}],buttons={ 'trade-accept':{},'trade-deny':{}};
 const state={trade:{acceptAt:3000,expiresAt:33000}};let ms=0;
 const source=app.slice(app.indexOf('  function updateTradeClock()'),app.indexOf('  function updateTimeoutButton()'));
 const update=new Function('state','document','$','Date','syncOffset',source+'\nreturn updateTradeClock;')(state,{querySelectorAll:()=>labels},id=>buttons[id],{now:()=>ms},0);
 update();assert.ok(labels.every(l=>l.textContent==='Review buffer: 3s'));assert.equal(buttons['trade-accept'].disabled,true);
 ms=3000;update();assert.ok(labels.every(l=>l.textContent==='Decision time: 30s'));assert.equal(buttons['trade-accept'].disabled,false);
 ms=32999;update();assert.ok(labels.every(l=>l.textContent==='Decision time: 1s'));
 ms=33000;update();assert.equal(buttons['trade-deny'].disabled,true);assert.equal(state.trade.expiresAt,33000);
 state.trade=null;update();assert.ok(labels.every(l=>l.hidden));
});
