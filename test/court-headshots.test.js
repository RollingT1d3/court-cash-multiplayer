import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../public/court-headshots.js',import.meta.url),'utf8');
const browser={};
runInNewContext(src,{window:browser});
const {DEFAULT_CROP,imageSource,cropRect,draw}=browser.CourtHeadshots;
const image=(w,h)=>({naturalWidth:w,naturalHeight:h});

test('court circles default to a square HEAD crop of the top of the illustration, not the entire torso',()=>{
  assert.equal(DEFAULT_CROP.width,.48);
  const src=cropRect(image(1200,1800),{image:'/illustration.png'});
  assert.equal(src.sw,576);
  assert.equal(src.sh,576);
  assert.equal(src.sx,312);
  assert.equal(src.sy,0);
  assert.ok(src.sy+src.sh<900,'source rectangle stays near top of 1800px full-body artwork');
});

test('each custom player can widen the head crop to preserve a BIG afro, poofy hair and dreads',()=>{
  const player={image:'/afro.png',courtPortrait:{crop:{centerX:.53,top:.02,width:.82}}};
  const crop=cropRect(image(1200,1900),player);
  assert.ok(Math.abs(crop.sw-984)<1e-9);
  assert.ok(Math.abs(crop.sh-984)<1e-9);
  assert.equal(crop.sy,38);
  assert.ok(Math.abs(crop.sx-144)<1e-9);
  const narrower=cropRect(image(1200,1900),{image:'/afro.png'});
  assert.ok(crop.sw>narrower.sw,'wider crop shows more hair, without stretching');
});

test('the head crop can be shifted to one side for asymmetrical hair and clamps to image edges',()=>{
  const crop=cropRect(image(1000,1500),{courtPortrait:{crop:{centerX:.99,top:.90,width:.7}}});
  assert.equal(crop.sx,300);
  assert.equal(crop.sy,800);
  assert.equal(crop.sw,700);
});

test('dedicated square face-and-hair portraits are preferred and never accidentally re-zoomed',()=>{
  const player={image:'/full-body.png',courtPortrait:{image:'/headshots/afro.png'}};
  assert.equal(imageSource(player),'/headshots/afro.png');
  const crop=cropRect(image(800,800),player);
  assert.equal(crop.sw,800);
  assert.equal(crop.sx,0);
  assert.equal(crop.sy,0);
  assert.equal(imageSource({image:'/full-body.png'}),'/full-body.png');
  assert.equal(imageSource({image:null}),null);
});

test('malformed crop configuration cannot cause out-of-bounds sampling',()=>{
  const crop=cropRect(image(600,1000),{courtPortrait:{crop:{centerX:3,top:-5,width:NaN}}});
  assert.ok(crop.sx>=0&&crop.sy>=0);
  assert.ok(crop.sx+crop.sw<=600&&crop.sy+crop.sh<=1000);
  assert.equal(crop.sw,crop.sh);
  assert.equal(cropRect(image(0,1000),{}),null);
});

test('on-court draw calls the 9-argument image crop API without stretching the head',()=>{
  let args;
  const ctx={drawImage(...params){args=params;}};
  const img=image(1200,1700);
  assert.equal(draw(ctx,img,{image:'/full.png'},200,150,44),true);
  assert.equal(args.length,9);
  assert.equal(args[0],img);
  assert.equal(args[3],args[4]);
  assert.deepEqual(args.slice(5),[178,128,44,44]);
  assert.equal(draw(ctx,{naturalWidth:0,naturalHeight:0},null,10,10,44),false);
});

test('browser loads the headshot helper before app; auction portraits keep original art and roster circles share the crop',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const headScript='<script src="/court-headshots.js" defer></script>';
  const appScript='<script src="/app.js" defer></script>';
  assert.ok(html.indexOf(headScript)>0&&html.indexOf(headScript)<html.indexOf(appScript));
  assert.match(app,/window\.CourtHeadshots\.imageSource\(p\)/);
  assert.match(app,/window\.CourtHeadshots\.draw\(ctx,entry\.img,p,prev\.x,prev\.y,44\)/);
  const rosterPortraitCode=app.slice(app.indexOf('function portrait('),app.indexOf('function rosterHeadshot('));
  assert.match(rosterPortraitCode,/p\.image/);
  assert.ok(!rosterPortraitCode.includes('CourtHeadshots'));
  assert.match(app,/window\.CourtHeadshots\.draw\(ctx,img,p,size\/2,size\/2,size\)/);
  assert.match(app,/rosterHeadshot\(p,i\?'red':'blue',s\)/);
  assert.match(app,/paintRosterHeadshots\(container\)/);
  assert.match(app,/bindDragHeadshot\(newPick,p,owner===0\?'blue':'red'\)/);
  assert.match(app,/appearance:state\.teams\.flatMap/);
  const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  assert.match(css,/\.roster-list \.roster-headshot\{[^}]*border-radius:50%/);
  assert.match(css,/\.roster-list \.slot\.drop-target \.roster-headshot/);
});


test('roster headshots paint saved crops using the shared draw helper and safely keep initials on missing images', async ()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('  function rosterImage('),app.indexOf('  function rosterDisplaySlots('));
  const p={id:'p001',image:'/full.webp',courtPortrait:{crop:{centerX:.75,top:.1,width:.6}}};
  const calls=[];const classes=[];
  const ctx={drawImage(...args){calls.push(args);}};
  const canvas={width:128,isConnected:true,dataset:{headshotId:p.id},getContext:()=>ctx,classList:{add:v=>classes.push(v)}};
  const missing={...canvas,dataset:{headshotId:'p002'}};
  class FakeImage {
    constructor(){this.naturalWidth=1000;this.naturalHeight=1500;}
    set src(value){queueMicrotask(()=>this.onload());}
  }
  const scope={state:{players:[p,{id:'p002',image:null}]},window:browser,rosterImages:new Map(),Image:FakeImage};
  runInNewContext(source+'\npaintRosterHeadshots({querySelectorAll:()=>[canvas,missing]});',{...scope,canvas,missing});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].slice(1),[400,150,600,600,0,0,128,128]);
  assert.deepEqual(classes,['ready']);
});

test('drag preview uses the exact saved head crop, a circular clip and a team-colored border',()=>{
  const p={name:'Bobby Buckets',image:'/full.webp',courtPortrait:{crop:{centerX:.75,top:.1,width:.6}}};
  const calls=[];
  const ctx={clearRect(){},save(){},beginPath(){},arc(...a){calls.push(['arc',...a]);},clip(){calls.push(['clip']);},fillRect(){},drawImage(...a){calls.push(['image',...a]);},restore(){},stroke(){calls.push(['stroke',this.strokeStyle]);},fillText(...a){calls.push(['text',...a]);}};
  const img=image(1000,1500);
  browser.CourtHeadshots.drawDragPreview(ctx,img,p,58,'blue');
  assert.deepEqual(calls.find(x=>x[0]==='image').slice(2),[400,150,600,600,2,2,54,54]);
  assert.ok(calls.some(x=>x[0]==='clip'));
  assert.deepEqual(calls.at(-1),['stroke','#7cb7ff']);
  calls.length=0;
  browser.CourtHeadshots.drawDragPreview(ctx,null,p,45,'red');
  assert.deepEqual(calls.find(x=>x[0]==='text'),['text','BB',22.5,22.5]);
  assert.deepEqual(calls.at(-1),['stroke','#ff859e']);
});

test('new picks and already assigned players use a centered custom native drag image, preserving the player ID', async ()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('  function bindDragHeadshot('),app.indexOf('  function teamPanel('));
  const calls=[],handlers={};
  const img=image(1000,1500),p={id:'p001',name:'Test Player',image:'/full.webp'};
  const canvas={style:{},getContext:()=>({}),setAttribute(){},remove(){calls.push(['removed']);}};
  const nested={draggable:true};
  const element={querySelectorAll:()=>[nested],querySelector:()=>null,addEventListener:(name,fn)=>handlers[name]=fn};
  const win={innerWidth:900,innerHeight:700,matchMedia:()=>({matches:false}),CourtHeadshots:{imageSource:()=>p.image,drawDragPreview:(...a)=>calls.push(['draw',...a])}};
  const document={createElement:()=>canvas,body:{appendChild:c=>calls.push(['append',c])}};
  const scope={window:win,document,rosterImage:()=>Promise.resolve(img),currentPicked:null,element,p,setTimeout:fn=>fn()};
  runInNewContext(source+"\nbindDragHeadshot(element,p,'red');",scope);
  await Promise.resolve();
  const transfer={setData:(...a)=>calls.push(['data',...a]),setDragImage:(...a)=>calls.push(['drag',...a])};
  handlers.dragstart({dataTransfer:transfer,clientX:100,clientY:100});
  assert.equal(nested.draggable,false);assert.equal(element.draggable,true);
  assert.equal(scope.currentPicked,p.id);assert.equal(transfer.effectAllowed,'move');
  assert.deepEqual(calls.find(x=>x[0]==='data'),['data','text/plain',p.id]);
  assert.deepEqual(calls.find(x=>x[0]==='draw').slice(2),[img,p,58,'red']);
  assert.deepEqual(calls.find(x=>x[0]==='drag'),['drag',canvas,29,29]);
  assert.equal(canvas.width,58);assert.equal(canvas.height,58);
  assert.deepEqual(calls.at(-1),['removed']);
  assert.match(app,/bindDragHeadshot\(slot,p,state.you===0\?'blue':'red'\)/);
});


test('auction and newly sold picks show square original artwork, with initials only as an image fallback',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('  function portrait('),app.indexOf('  function rosterHeadshot('));
  const p={name:'Bobby Buckets',id:'p019',image:'/images/p019.webp'};
  const scope={state:null,esc:s=>String(s),p};
  const markup=runInNewContext(source+"\nportrait(p,'xl','blue',true)",scope);
  assert.match(markup,/auction-artwork/);
  assert.match(markup,/src="\/images\/p019.webp"/);
  assert.match(markup,/class="portrait-initials">BB/);
  const fallback={hidden:false},classes=new Set();
  const img={nextElementSibling:fallback,classList:{add:s=>classes.add(s),remove:s=>classes.delete(s)}};
  for(const [event,hidden] of [['load',true],['error',false],['load',true]]){
    const handler=markup.match(new RegExp('on'+event+'="([^"]+)"'))[1];
    new Function(handler).call(img);
    assert.equal(fallback.hidden,hidden);
    assert.equal(classes.has('loaded'),hidden);
  }
  assert.match(app,/portrait\(p,'xl','blue',true\)/);
  assert.match(app,/portrait\(p,'xl',owner===0\?'blue':'red',true\)/);
  assert.match(css,/\.portrait\.auction-artwork\.xl\{[^}]*width:192px;height:192px;border-radius:0/);
  assert.match(css,/\.portrait\.auction-artwork>img\{object-fit:contain\}/);
  assert.match(css,/\.portrait>\.portrait-initials\[hidden\]\{display:none\}/);
  assert.doesNotMatch(runInNewContext(source+"\nportrait(p,'med','red')",scope),/auction-artwork/);
});
