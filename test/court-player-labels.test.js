import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js');
const source=app.slice(app.indexOf('  function courtPlayerLabel('),app.indexOf('  function drawInitials('));
const label=new Function(source+'\nreturn courtPlayerLabel;')();
test('quoted nicknames replace first names on the court, preserving punctuation and spaces',()=>{
 for(const [name,expected] of [["Payne \"Sleepy\" Pines","Sleepy"],["Hunter “Shotgun” Williams","Shotgun"],["Zade “Big Dukey” Grey","Big Dukey"],["Cason “BANG!” Cooper","BANG!"],["Patrick \"Pimpin' P\" Pattington","Pimpin' P"],["Kontavious “I just shoot” Popper","I just shoot"],["De’Ko Ko’De","De’Ko"],["Good Ol’ Farmer Berry","Good"],["Bald Eagle","Bald"],["Buddy","Buddy"],["First \"\" Last","First"],["First “Incomplete Last","First"],["  First   Last  ","First"]])assert.equal(label(name),expected,name);
});
test('every published player gets the correct nickname or first-name label',()=>{
 const players=['data/players.json','data/players-3.json','data/players-4.json','data/players-5.json'].flatMap(p=>JSON.parse(read(p)));
 for(const p of players){
  const expected=p.name.includes('"')?p.name.split('"')[1]:p.name.includes('“')?p.name.split('“')[1].split('”')[0]:p.name.trim().split(/\s+/)[0];
  assert.equal(label(p.name),expected,p.name);
 }
});
test('both canvas outline and fill use the full nickname on the live player marker',()=>{
 const line=app.split('\n').find(l=>l.includes('const label=courtPlayerLabel(p.name);'));
 assert.ok(line);const calls=[];
 new Function('courtPlayerLabel','ctx','p','prev',line)(label,{strokeText:(...a)=>calls.push(a),fillText:(...a)=>calls.push(a)},{name:'Hunter “Shotgun” Williams'},{x:100,y:200});
 assert.deepEqual(calls,[['Shotgun',100,239,120],['Shotgun',100,239,120]]);
});
