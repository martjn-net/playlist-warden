import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asBool, asInt, asString, asStringArray, asStringOrNull } from '../utils/coerce.ts';

test('asString / asStringOrNull', () => {
  assert.equal(asString('x'), 'x');
  assert.equal(asString(5), '');
  assert.equal(asString(undefined, '?'), '?');
  assert.equal(asStringOrNull('x'), 'x');
  assert.equal(asStringOrNull(5), null);
});

test('asBool falls back only when missing', () => {
  assert.equal(asBool(true, false), true);
  assert.equal(asBool(undefined, true), true);
  assert.equal(asBool(null, true), true);
  assert.equal(asBool(0, true), false); // present but falsy → coerced, not default
});

test('asInt keeps positive integers, else 0', () => {
  assert.equal(asInt(5), 5);
  assert.equal(asInt('900'), 900);
  assert.equal(asInt(-3), 0);
  assert.equal(asInt('nope'), 0);
  assert.equal(asInt(3.9), 3);
});

test('asStringArray keeps only string members', () => {
  assert.deepEqual(asStringArray(['a', 2, 'b', null]), ['a', 'b']);
  assert.deepEqual(asStringArray('nope'), []);
});
