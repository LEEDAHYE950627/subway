import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalTiming, remaining, receivedTime, isStale, selectTrains, trainPosition } from '../src/arrival.js';
const now = Date.parse('2026-11-06T12:00:30+09:00');
const row = { barvlDt: '100', recptnDt: '2026-11-06 12:00:00', updnLine: '상행', btrainNo: '100', arvlCd: '99', btrainSttus: '일반', ordkey: '01001' };
test('arrival countdown accounts for source age in Seoul time', () => {
  assert.equal(receivedTime(row.recptnDt), now - 30000);
  assert.equal(remaining(row, now), 70);
  assert.equal(remaining(row, now + 1000), 69);
  assert.equal(remaining(row, now + 100000), 0);
  assert.equal(remaining({ ...row, barvlDt: '0', ordkey: '' }, now), null);
  assert.equal(remaining({ ...row, recptnDt: '' }, now), null);
});
test('zero ETA falls back to explicitly estimated status and station distance', () => {
  const sample = { ...row, barvlDt: '0', observedAt: now, arvlCd: '5' };
  assert.deepEqual(arrivalTiming(sample, now), { seconds: 110, estimated: true });
  assert.equal(remaining(sample, now + 1000), 109);
  assert.equal(remaining({ ...sample, arvlCd: '3' }, now), 70);
  assert.equal(remaining({ ...sample, arvlCd: '99', arvlMsg2: '[2]번째 전역 (부개)' }, now), 220);
  assert.equal(remaining({ ...sample, arvlCd: '99', ordkey: '12005인천0' }, now), 550);
  assert.equal(remaining({ ...sample, arvlCd: '0' }, now), null);
  assert.equal(remaining({ ...sample, arvlCd: '1' }, now), null);
  assert.equal(remaining(sample, now + 200000), 0);
});
test('stale information suppresses train marker', () => {
  assert.equal(isStale(row, now), false);
  assert.equal(isStale(row, now + 121000), true);
  assert.equal(trainPosition(row, now + 121000, '상행'), null);
});
test('icons approach Jungdong from the correct neighboring station', () => {
  assert.ok(trainPosition(row, now, '상행') < 50);
  assert.ok(trainPosition(row, now, '하행') > 50);
  assert.ok(trainPosition(row, now + 1000, '상행') > trainPosition(row, now, '상행'));
  assert.equal(trainPosition({ ...row, barvlDt: '0', arvlCd: '1' }, now, '상행'), 50);
});
test('only stopping, inbound trains in a given direction are shown once', () => {
  const rows = [row, { ...row }, { ...row, btrainNo: '2', btrainSttus: '급행' }, { ...row, btrainNo: '3', updnLine: '하행' }, { ...row, btrainNo: '4', arvlCd: '2' }];
  assert.deepEqual(selectTrains(rows, '상행').map(r => r.btrainNo), ['100']);
});
