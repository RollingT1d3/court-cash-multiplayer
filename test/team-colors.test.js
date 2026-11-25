import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/team-colors.js';
const {palette,valid,choose,ink}=globalThis.CourtTeamColors;
test('all 24 team colors are validated, defaults remain blue and red, duplicates are rejected',()=>{
  assert.equal(Object.keys(palette).length,24);
  for(const id of Object.keys(palette)){assert.ok(valid(id));assert.equal(choose(id,0),id);}
  for(const id of ['poop','dog poop','puke','periwinkle','other sky','highlighter','rust','night sky','flower','burnt toast','fire']){
    assert.ok(valid(id));assert.equal(choose(id,1,'blue'),id);
    assert.throws(()=>choose(id,1,id),/already taken/);
  }
  assert.equal(choose(null,0),'blue');
  assert.equal(choose(null,1,'blue'),'red');
  assert.equal(choose(null,1,'red'),'blue');
  assert.throws(()=>choose('purple',1,'purple'),/already taken/);
  for(const id of ['__proto__','constructor','#fff','invalid'])assert.throws(()=>choose(id,0),/valid team color/);
  assert.equal(palette.highlighter,'#ffff00');assert.equal(palette.rust,'#a34b32');assert.equal(palette['night sky'],'#303d52');
  assert.equal(ink('highlighter'),'#111827');assert.equal(ink('night sky'),'#ffffff');
  assert.equal(palette.flower,'#f6b9ce');assert.equal(palette['burnt toast'],'#82766c');assert.equal(palette.fire,'#ff8000');
  assert.equal(ink('black'),'#ffffff');assert.equal(ink('white'),'#111827');assert.equal(ink('sun'),'#111827');
});
