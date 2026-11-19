import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

// Only the RFC 8785 subset used by these published vectors is exercised here.
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const pairs = Object.keys(value).sort().map(key => {
    assert.match(key, /^[\x20-\x7e]+$/, 'Fixture keys must be ASCII');
    return JSON.stringify(key) + ':' + canonical(value[key]);
  });
  return '{' + pairs.join(',') + '}';
}
