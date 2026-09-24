import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRange } from '../src/ranges.js';
test('preset ranges have no gaps or overlapping boundaries', () => {
  assert.ok(matchesRange(1,{mode:'bucket',min:'0',max:'1'}));
  assert.equal(matchesRange(1,{mode:'bucket',min:'1',max:'3'}),false);
  assert.ok(matchesRange(3.5,{mode:'bucket',min:'3',max:'6'}));
  assert.ok(matchesRange(6,{mode:'bucket',min:'3',max:'6'}));
  assert.ok(matchesRange(100,{mode:'bucket',min:'64',max:''}));
  assert.equal(matchesRange(null,{mode:'bucket',min:'0',max:'1'}),false);
});
test('size and context boundaries combine precisely', () => {
  const size = {mode:'between',min:'6',max:'8'};
  assert.ok(matchesRange(6,size) && matchesRange(8,size));
  assert.equal(matchesRange(8.1,size),false);
  assert.ok(matchesRange(29.9,{mode:'lt',min:'30'}));
  assert.equal(matchesRange(30,{mode:'lt',min:'30'}),false);
  assert.ok(matchesRange(8,{mode:'eq',min:'8'}));
  assert.equal(matchesRange(8.1,{mode:'eq',min:'8'}),false);
  assert.ok(matchesRange(10,{mode:'between',min:'10',max:'30'}));
  assert.ok(matchesRange(30,{mode:'between',min:'10',max:'30'}));
});
test('unknown values and open or invalid ranges', () => {
  assert.equal(matchesRange(null,{mode:'eq',min:'8'}),false);
  assert.ok(matchesRange(5,{mode:'between',min:'',max:'8'}));
  assert.equal(matchesRange(7,{mode:'between',min:'8',max:'6'}),false);
  assert.ok(matchesRange(null,{mode:'any'}));
});
