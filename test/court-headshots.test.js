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

test('browser loads face-only crop helper before app; main draft portraits stay full-art',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const headScript='<script src="/court-headshots.js" defer></script>';
  const appScript='<script src="/app.js" defer></script>';
  assert.ok(html.indexOf(headScript)>0&&html.indexOf(headScript)<html.indexOf(appScript));
  assert.match(app,/window\.CourtHeadshots\.imageSource\(p\)/);
  assert.match(app,/window\.CourtHeadshots\.draw\(ctx,entry\.img,p,prev\.x,prev\.y,44\)/);
  const rosterPortraitCode=app.slice(app.indexOf('function portrait('),app.indexOf('function rosterDisplaySlots('));
  assert.match(rosterPortraitCode,/p\.image/);
  assert.ok(!rosterPortraitCode.includes('CourtHeadshots'));
});
