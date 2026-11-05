'use strict';
const assert = require('node:assert/strict');
const BrainAdaptive = require('../adaptive');
const data = new Map();
const storage = {getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v)};
const A = new BrainAdaptive(storage);
function p(n1, symbol, n2) { return { n1, symbol, n2 }; }
assert.deepEqual(BrainAdaptive.classify(p(53,'+',47)).includes('round_pair'), true);
assert.deepEqual(BrainAdaptive.classify(p(59,'+',9)).includes('add_carry'), true);
assert.deepEqual(BrainAdaptive.classify(p(41,'−',37)).includes('sub_borrow'), true);
assert.deepEqual(BrainAdaptive.classify(p(64,'−',20)).includes('sub_tens'), true);
assert.deepEqual(BrainAdaptive.classify(p(11,'×',12)).includes('mul_eleven'), true);
assert.deepEqual(BrainAdaptive.classify(p(24,'÷',4)).includes('division'), true);
assert.equal(A.focus('medium',['add']).length,0,'cold start must not diagnose');
// 6 observations; two separate sessions; more than 4 distinct carry problems with repeated failure.
[[59,9,false],[49,8,true],[69,7,false],[39,6,true],[29,9,false],[48,7,true]].forEach(([x,y,ok],i)=> A.observe(p(x,'+',y), ok, ok?2200:3100, 'medium', i<3?'session-1':'session-2'));
const focus=A.focus('medium',['add']);
assert(focus.some(s=>s.id==='add_carry'),'repeated errors must identify skill');
assert.equal(A.focus('easy',['add']).length,0,'other difficulty kept distinct');
assert.equal(A.focus('medium',['sub']).length,0,'other operation kept distinct');
assert.equal(new BrainAdaptive(storage).focus('medium',['add']).length>0,true,'history persists');
const seen = [];
let focusCount=0;
for(let slot=0;slot<15;slot++) {
 const c=A.chooseLearningProblem(()=>p(10+Math.floor(Math.random()*60),'+',1+Math.floor(Math.random()*39)),'medium',['add'],seen,slot);
 seen.push(BrainAdaptive.keyOf(c));
 if([2,6,10,13].includes(slot) && BrainAdaptive.classify(c).some(tag=>focus.some(f=>f.id===tag)))focusCount++;
}
assert.equal(focusCount,4,'focus slots should work');
assert.equal(new Set(seen).size,15,'different examples, no rote repetition');
const B = new BrainAdaptive(null);
for(let i=0;i<30;i++) B.observe(p(53,'+',47),false,15000,'medium','same-session');
assert.equal(B.focus('medium',['add']).length,0,'same expression/same session is not sufficient');
console.log('PASS: classifiers, cold start, evidence thresholds, persistence, differentiation, interleaving, uniqueness');
