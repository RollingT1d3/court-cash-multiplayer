import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fatigueAttributePreview,fatiguedSkill} from '../fatigue-v084.js';
const stats=Object.fromEntries(['layup','dunk','post','ft','mid','three','fades','passing','dribbling','paintDef','perimeterDef','block','steal','rebound','strength','speed','iq','teamwork','stamina'].map(k=>[k,90]));
test('bench preview shares the real fatigue multipliers, excludes unaffected stats and never mutates base attributes',()=>{
 const original={...stats};
 assert.deepEqual(fatigueAttributePreview(stats,100),{});
 for(const energy of [0,29.9,30,50,99.9]){
  const v=fatigueAttributePreview(stats,energy);
  for(const key of ['layup','dunk','post'])assert.equal(v[key],fatiguedSkill(stats[key],energy,'finishing'));
  for(const key of ['mid','three','fades'])assert.equal(v[key],fatiguedSkill(stats[key],energy,'shooting'));
  for(const key of ['paintDef','perimeterDef','block','steal'])assert.equal(v[key],fatiguedSkill(stats[key],energy,'defense'));
  for(const key of ['ft','passing','dribbling','rebound','strength','speed','iq','teamwork','stamina'])assert.equal(v[key],undefined);
  assert.equal(Object.keys(v).length,10);
 }
 assert.deepEqual(stats,original);
 assert.deepEqual(fatigueAttributePreview({three:0},10),{});
});
test('fatigue markup is yellow at exactly 30, red below 30, and normal for unaffected stats',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const source=app.slice(app.indexOf('  function fatigueRatingMarkup('),app.indexOf('  function weightedRows('));
 const markup=new Function('esc',source+'\nreturn fatigueRatingMarkup;')(String);
 assert.match(markup(90,80,30),/fatigue-reduced/);
 assert.match(markup(90,80,29.99),/fatigue-critical/);
 assert.match(markup(90,80,29),/⌄/);
 assert.match(markup(90,89.99,99.9),/89\.99/);
 assert.equal(markup(90,undefined,10),'<strong>90</strong>');
 assert.equal(markup(90,90,0),'<strong>90</strong>');
 assert.ok(app.includes("if($('bench-details-dialog').open)refreshBenchDetails()"));
 const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.ok(server.includes('fatigueAttributePreview(getPlayer(id).stats,t.energy[id]??100)'));
});
