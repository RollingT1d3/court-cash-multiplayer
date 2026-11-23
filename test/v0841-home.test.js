import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/index.html');
const css=read('public/style.css');

test('v0.8.41 marks correct version in browser and server package',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'0.8.41');
  assert.match(html,/ALPHA v0\.8\.41/);
});

test('v0.8.41 shows original player art on left and right of homepage only',()=>{
  const welcome=html.split('<section id="welcome"')[1].split('<section id="gameview"')[0];
  assert.match(welcome,/class="welcome-figure welcome-figure-left" src="\/home-left\.avif"/);
  assert.match(welcome,/class="welcome-figure welcome-figure-right" src="\/home-right\.avif"/);
  assert.match(welcome,/aria-hidden="true" draggable="false"/);
  assert.match(css,/\.welcome-figure-left\s*\{/);
  assert.match(css,/\.welcome-figure-right\s*\{/);
  assert.match(css,/\.welcome-figure\s*\{[\s\S]*?pointer-events: none;/);
  assert.doesNotMatch(welcome,/creepy|peeking|peek-head/);
});

test('v0.8.41 retains both working room forms as HTML controls',()=>{
  assert.match(html,/<form id="create-form" class="card">/);
  assert.match(html,/<form id="join-form" class="card">/);
  for(const id of ['create-name','join-name','join-code','format']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/<button class="primary full" type="submit">CREATE PRIVATE ROOM/);
  assert.match(html,/<button class="secondary full" type="submit">JOIN ROOM/);
  assert.match(css,/\.welcome-content\s*\{[\s\S]*?656px/);
  assert.match(css,/\.welcome \.onboarding\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(css,/@media \(max-width: 990px\)\s*\{[\s\S]*?\.welcome \.onboarding\s*\{\s*grid-template-columns:\s*1fr/);
});

test('v0.8.41 transparent AVIF character assets are actual decodable AVIF files',()=>{
  for(const path of ['public/home-left.avif','public/home-right.avif']){
    const full=new URL('../'+path,import.meta.url);
    assert.ok(statSync(full).size>3000);
    const head=readFileSync(full).subarray(0,32);
    assert.equal(head.toString('ascii',4,8),'ftyp');
    assert.ok(head.toString('ascii').includes('avif'));
  }
});
