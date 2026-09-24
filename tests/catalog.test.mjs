import test from 'node:test';
import assert from 'node:assert/strict';
import { selectModels } from '../src/catalog.js';
import { readFile } from 'node:fs/promises';

test('snapshot contains unique complete model records', async () => {
  const data = JSON.parse(await readFile(new URL('../public/data/models.json', import.meta.url)));
  assert.equal(data.count, data.models.length);
  assert.ok(data.count > 0);
  assert.equal(new Set(data.models.map(model => model.name)).size, data.count);
  for (const model of data.models) {
    assert.ok(model.url.startsWith('https://ollama.com/library/'));
    assert.ok(Number.isFinite(model.pulls));
    assert.ok(Number.isFinite(Date.parse(model.updatedAt)));
  }
});
const models = [
  { name: 'alpha', description: 'Code model', capabilities: ['tools'], sizes: ['7b'], pulls: 900, tags: 2 },
  { name: 'beta', description: 'Vision model', capabilities: ['vision'], sizes: ['3b'], pulls: 10000, tags: 1 },
];
test('combines case-insensitive search, capability, size and selection filters', () => {
  assert.deepEqual(selectModels(models, { query: 'CODE ALPHA', capability: 'tools', size: '7b' }).map(m => m.name), ['alpha']);
  assert.equal(selectModels(models, { query: 'code', capability: 'vision' }).length, 0);
  assert.deepEqual(selectModels(models, { selectedOnly: true, selected: ['beta'] }).map(m => m.name), ['beta']);
});
test('sorts counts numerically in both directions', () => {
  assert.equal(selectModels(models, { sort: 'pulls', direction: 'desc' })[0].name, 'beta');
  assert.equal(selectModels(models, { sort: 'pulls', direction: 'asc' })[0].name, 'alpha');
});
