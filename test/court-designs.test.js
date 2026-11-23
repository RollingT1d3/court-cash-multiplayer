import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { COURT_STYLES, chooseCourtStyle } from '../court-styles.js';

const browser = {};
runInNewContext(readFileSync(new URL('../public/court-designs.js', import.meta.url), 'utf8'), { window: browser });
const { COURT_STYLES: BROWSER_STYLES, PALETTES, STARS, traceThreePoint, drawCourt } = browser.CourtDesigns;

function recordingContext() {
  const calls=[];
  const ctx={
    fillStyle:null,strokeStyle:null,lineWidth:0,
    save(){calls.push({type:'save'});},restore(){calls.push({type:'restore'});},
    beginPath(){calls.push({type:'begin'});},
    moveTo(...args){calls.push({type:'moveTo',args});},
    lineTo(...args){calls.push({type:'lineTo',args});},
    arc(...args){calls.push({type:'arc',args});},
    rect(...args){calls.push({type:'rect',args});},
    stroke(){calls.push({type:'stroke',color:this.strokeStyle});},
    strokeRect(...args){calls.push({type:'strokeRect',args,color:this.strokeStyle});},
    fillRect(...args){calls.push({type:'fillRect',args,color:this.fillStyle});},
    closePath(){calls.push({type:'close'});},
    fill(){calls.push({type:'fill',color:this.fillStyle});}
  };
  return {ctx,calls};
}

const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} must equal ${b}`);

test('four named courts selected in exact equal 25% probability brackets',()=>{
  assert.equal(COURT_STYLES.length,4);
  assert.deepEqual(Array.from(BROWSER_STYLES),Array.from(COURT_STYLES));
  for(let i=0;i<4;i++){
    assert.equal(chooseCourtStyle(()=>(i+.5)/4),COURT_STYLES[i]);
    assert.equal(chooseCourtStyle(()=>i/4),COURT_STYLES[i]);
    assert.equal(chooseCourtStyle(()=>(i+1)/4-1e-8),COURT_STYLES[i]);
  }
  assert.throws(()=>chooseCourtStyle(()=>1),/random/i);
  assert.throws(()=>chooseCourtStyle(()=>-1),/random/i);
});

test('3-point line is a single continuous court-accurate path for BOTH baskets',()=>{
  for(const side of [0,1]){
    const {ctx,calls}=recordingContext();
    const g=traceThreePoint(ctx,side,940,525);
    const path=calls.filter(x=>['begin','moveTo','lineTo','arc','stroke'].includes(x.type));
    assert.deepEqual(path.map(x=>x.type),['begin','moveTo','lineTo','arc','lineTo','stroke']);
    near(g.topY,40); near(g.bottomY,485); near(g.radius,231.5);
    assert.ok(g.xJoin>(side===0?110:790)&&g.xJoin<(side===0?150:830), 'corner line moved toward basket');
    const baseline=side===0?17:923;
    near(path[1].args[0],baseline); near(path[1].args[1],40);
    near(path[2].args[0],g.xJoin); near(path[2].args[1],40);
    near(path[4].args[0],baseline); near(path[4].args[1],485);
    const [cx,cy,r,start,end,ccw]=path[3].args;
    near(cx,side===0?69.5:870.5);near(cy,262.5);near(r,231.5);
    near(cx+r*Math.cos(start),g.xJoin);
    near(cy+r*Math.sin(start),40);
    near(cx+r*Math.cos(end),g.xJoin);
    near(cy+r*Math.sin(end),485);
    assert.equal(ccw,side===1,'right arc must travel around basket toward midcourt');
    // The arc reaches the correct maximum depth toward half court.
    near(side===0?cx+r:cx-r,side===0?301:639);
  }
});

test('midnight: black floor, white lines and a handful of cartoon white stars',()=>{
  const {ctx,calls}=recordingContext();drawCourt(ctx,'midnight-stars');
  assert.equal(calls.find(x=>x.type==='fillRect').color,'#07090d');
  assert.equal(calls.find(x=>x.type==='strokeRect').color,'#ffffff');
  assert.ok(STARS.length>=6 && STARS.length<=15);
  assert.equal(calls.filter(x=>x.type==='fill').length,STARS.length);
  assert.ok(calls.filter(x=>x.type==='fill').every(x=>x.color==='#ffffff'));
});

test('dark brown: brown court with BLACK outlines and no stars',()=>{
  const {ctx,calls}=recordingContext();drawCourt(ctx,'dark-brown');
  assert.equal(calls.find(x=>x.type==='fillRect').color,'#795032');
  assert.equal(calls.find(x=>x.type==='strokeRect').color,'#090704');
  assert.equal(calls.filter(x=>x.type==='fill').length,0);
});

test('blue: dark blue floor, WHITE lines, SKY BLUE painted keys and OUT OF BOUNDS',()=>{
  const {ctx,calls}=recordingContext();drawCourt(ctx,'blue-sky');
  const fills=calls.filter(x=>x.type==='fillRect');
  assert.equal(fills[0].color,'#83ceff','out-of-bounds');
  assert.equal(fills[1].color,'#113a7b','in-bounds court');
  assert.deepEqual(fills.slice(2,4).map(x=>x.color),['#83ceff','#83ceff']);
  assert.equal(calls.find(x=>x.type==='strokeRect').color,'#ffffff');
});

test('white: white floor with BLACK lines and no stars',()=>{
  const {ctx,calls}=recordingContext();drawCourt(ctx,'whiteout');
  assert.equal(calls.find(x=>x.type==='fillRect').color,'#fcfcfa');
  assert.equal(calls.find(x=>x.type==='strokeRect').color,'#080808');
  assert.equal(calls.filter(x=>x.type==='fill').length,0);
});

test('canvas uses the server-selected game court and script loads before app',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.ok(html.indexOf('src="/court-designs.js"')>0);
  assert.ok(html.indexOf('src="/court-designs.js"')<html.indexOf('src="/app.js"'));
  assert.match(app,/CourtDesigns\.drawCourt\(ctx,state\.game\.courtStyle,W,H\)/);
  assert.match(server,/courtStyle=chooseCourtStyle\(rnd\)/);
  assert.match(server,/tipoff,courtStyle\}/);
});
