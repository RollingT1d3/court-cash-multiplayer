import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('v0.5.2 court geometry preserved in v0.6: size, aspect ratio and click mapping',()=>{
  const html=read('public/index.html'),css=read('public/style.css'),app=read('public/app.js');
  assert.match(html,/id="court" width="940" height="525"/);
  assert.match(css,/aspect-ratio:940\/525/);
  assert.match(app,/const W=940,H=525/);
  assert.match(app,/\*525\/rect\.height/);
});
test('current deployment identifiable by /health version and main menu version',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'0.9.1');
  assert.match(read('public/index.html'),/ALPHA v0\.9\.1/);
  assert.match(read('server.js'),/gitCommit:process\.env\.RENDER_GIT_COMMIT\|\|null/);
  assert.match(read('server.js'),/version:BUILD_VERSION/);
  assert.match(read('server.js'),/fresh\?'no-store':'public,max-age=3600'/);
});
test('Render Blueprint requests redeploy on every new main-branch commit',()=>{
  assert.match(read('render.yaml'),/autoDeployTrigger: commit/);
});
test('pass lane distance calculation follows taller court',()=>{
  const rules=read('court-rules-v05.js');
  assert.match(rules,/dy=\(to\.y-from\.y\)\*525/);
  assert.match(rules,/gy=\(guard\.y-from\.y\)\*525/);
});
