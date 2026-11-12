import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalsUrl } from '../src/api.js';

test('local development uses the Vite API while production requires a server', () => {
  assert.equal(arrivalsUrl(''), '/api/arrivals');
  assert.throws(() => arrivalsUrl('', true), /VITE_API_BASE_URL/);
  assert.throws(() => arrivalsUrl('   ', true), /VITE_API_BASE_URL/);
});

test('production connects to an HTTPS API origin without the Pages repository path', () => {
  assert.equal(arrivalsUrl(' https://subway.example.com/ ', true), 'https://subway.example.com/api/arrivals');
  for (const value of ['http://api.example.com', '/subway', 'https://api.example.com/api/arrivals', 'https://key@api.example.com', 'https://api.example.com?key=secret']) {
    assert.throws(() => arrivalsUrl(value, true), /VITE_API_BASE_URL/);
  }
});
