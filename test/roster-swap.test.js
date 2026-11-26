import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
test('click selects, repeated click deselects, another player swaps and clears selection',()=>{
 const source=app.slice(app.indexOf('  function rosterClickSelection('),app.indexOf('  function bindRoster('));
 const click=new Function(source+'\nreturn rosterClickSelection;')();
 assert.deepEqual(click(null,'a'),{next:'a',swap:null});
 assert.deepEqual(click('a','a'),{next:null,swap:null});
 assert.deepEqual(click('a','b'),{next:null,swap:'a'});
 assert.deepEqual(click('a',null),{next:null,swap:'a'});
 assert.deepEqual(click(null,null),{next:null,swap:null});
});
test('timeout swaps persist active and bench order, including foul-out replacements',()=>{
 const source=server.slice(server.indexOf("        const slotIdx=SLOTS.indexOf(slot);",server.indexOf("case 'place':")),server.indexOf("        broadcast(room);break;",server.indexOf("case 'place':")));
 const swap=new Function('g','i','id','slot','SLOTS',source);
 const slots=['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
 const g={active:[['a','b','c','d','e']],bench:[['f','g','h']],fouledOut:[]};
 swap(g,0,'a','SG',slots);assert.deepEqual(g.active[0],['b','a','c','d','e']);
 swap(g,0,'f','PG',slots);assert.deepEqual(g.active[0],['f','a','c','d','e']);assert.deepEqual(g.bench[0],['b','g','h']);
 swap(g,0,'g','Bench 2',slots);assert.deepEqual(g.bench[0],['b','h','g']);
 g.fouledOut=['h'];
 assert.throws(()=>swap(g,0,'h','PG',slots),/fouled out/);
 assert.throws(()=>swap(g,0,'f','Bench 1',slots),/fouled out/);
 assert.ok(server.includes('g.bench[i][benchIndex]=required.playerId'));
 assert.ok(app.includes('state.game.bench?.[i]'));
 assert.ok(app.includes('active:state.game?.active,bench:state.game?.bench'));
});
