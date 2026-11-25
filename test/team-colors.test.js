import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/team-colors.js';
const {palette,valid,choose,ink}=globalThis.CourtTeamColors;
test('all 13 team colors are validated, defaults remain blue and red, duplicates are rejected',()=>{
  assert.equal(Object.keys(palette).length,13);
  for(const id of Object.keys(palette)){assert.ok(valid(id));assert.equal(choose(id,0),id);}
  assert.equal(choose(null,0),'blue');
  assert.equal(choose(null,1,'blue'),'red');
  assert.equal(choose(null,1,'red'),'blue');
  assert.throws(()=>choose('purple',1,'purple'),/already taken/);
  for(const id of ['__proto__','constructor','#fff','invalid'])assert.throws(()=>choose(id,0),/valid team color/);
  assert.equal(ink('black'),'#ffffff');assert.equal(ink('white'),'#111827');assert.equal(ink('sun'),'#111827');
});
