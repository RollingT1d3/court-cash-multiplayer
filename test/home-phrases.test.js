import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_PHRASES, pickHomePhrase, renderHomePhrase } from '../public/home-phrases.js';

const expectedWeights = [5,5,5,2,18,10,5,5,5,10,10,10,5,5];

test('all 14 user-authored phrases retain their exact weight and total 100%', () => {
  assert.equal(HOME_PHRASES.length, 14);
  assert.deepEqual(HOME_PHRASES.map(item => item.weight), expectedWeights);
  assert.equal(HOME_PHRASES.reduce((a,b) => a+b.weight,0),100);
  assert.equal(HOME_PHRASES[0].text,'Shoutout ceekel');
  assert.equal(HOME_PHRASES.at(-1).text,'Jesus Loves You');
  assert.equal(HOME_PHRASES[9].text,'Ice man was a nice man, now I’m hot and cold🥶🔥');
  assert.equal(HOME_PHRASES[12].text,'She in my phone with a nickname, it’s, it’s, it’s…Grippy!🥹');
});

test('precise weighted interval edges select the expected phrase', () => {
  let sum=0;
  for (let i=0;i<HOME_PHRASES.length;i++) {
    const phrase=HOME_PHRASES[i];
    assert.equal(pickHomePhrase(()=>((sum+phrase.weight/2)/100)), phrase.text);
    sum+=phrase.weight;
    if (i<HOME_PHRASES.length-1) {
      assert.equal(pickHomePhrase(()=>sum/100), HOME_PHRASES[i+1].text);
    }
  }
  assert.equal(pickHomePhrase(()=>0),HOME_PHRASES[0].text);
  assert.equal(pickHomePhrase(()=>.999999), HOME_PHRASES.at(-1).text);
  assert.throws(()=>pickHomePhrase(()=>1),/Random/);
  assert.throws(()=>pickHomePhrase(()=>-1),/Random/);
  assert.throws(()=>pickHomePhrase(()=>Number.NaN),/Random/);
});

test('phrase is rendered safely as text, not markup', () => {
  const el={textContent:''};
  const doc={getElementById:id=>id==='home-phrase'?el:null};
  const result=renderHomePhrase(doc,()=>.99);
  assert.equal(result,'Jesus Loves You');
  assert.equal(el.textContent,result);
  assert.equal(renderHomePhrase({getElementById:()=>null},()=>.5),null);
});

test('homepage retains headline, shows subtitle and loads weighted phrase module',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/<h1>Draft big\.<br \/><em>Play bigger\.<\/em><\/h1>/);
  assert.match(html,/<p class="lead" id="home-phrase">/);
  assert.match(html,/<script type="module" src="\/home-phrases\.js"><\/script>/);
  assert.match(html,/<script src="\/app\.js" defer><\/script>/);
  assert.ok(!html.includes('Two friends. Fifty dollars each. Eight-man teams. One animated showdown.'));
});
