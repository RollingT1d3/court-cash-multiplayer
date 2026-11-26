import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assistAwardChance} from '../assist-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('assist base probability rises 20 percentage points; teamwork still matters',()=>{
  close(assistAwardChance(.15),.6375);
  close(assistAwardChance((85-45)/55),.7818181818181819);
  close(assistAwardChance(1),.85);
  close(assistAwardChance(0),.6375);
});
test('existing strategy and screen bonuses remain; assist probability caps at 98%',()=>{
  const c=(85-45)/55,b=assistAwardChance(c);
  close(assistAwardChance(c,{teamBall:true}),b+.12);
  close(assistAwardChance(c,{oldSchool:true}),b+.18);
  close(assistAwardChance(c,{runGun:true,screen:true}),b+.16);
  close(assistAwardChance(c,{chaos:true,screen:true}),b+.10);
  close(assistAwardChance(c,{runGun:true,screen:false}),b);
  close(assistAwardChance(c,{chaos:true,screen:false}),b);
  close(assistAwardChance(1,{oldSchool:true}),.98);
});
test('server credits only the final successful passer in the made-shot branch',()=>{
  const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(s,/else if\(rnd\(\)<chance\)\{[\s\S]*?made=true;[\s\S]*?const assistChance=assistAwardChance\(passerCompliance,[^\n]+\);\s*if\(passerId && passOutcome==='complete' && rnd\(\)<assistChance\)\{\s*assistId=passerId;g\.stats\[assistId\]\.ast\+\+;/);
});
