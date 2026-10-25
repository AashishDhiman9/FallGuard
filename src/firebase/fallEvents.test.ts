import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFallEvent } from './fallEvents.js';

test('normalizes canonical patientUid event records', () => {
  const event = normalizeFallEvent('event-1', {
    id: 'event-1',
    patientUid: 'patient-1',
    patientName: 'Patient One',
    timestamp: 1792946000000,
    type: 'confirmed_fall',
    status: 'active',
  }, { userId: 'fallback', userName: 'Fallback' });

  assert.equal(event?.userId, 'patient-1');
  assert.equal(event?.userName, 'Patient One');
  assert.equal(event?.timestamp, new Date(1792946000000).toISOString());
  assert.equal(event?.type, 'confirmed_fall');
});

test('normalizes legacy userId and userName event records', () => {
  const event = normalizeFallEvent('legacy-event', {
    userId: 'patient-1',
    userName: 'Patient One',
    timestamp: '2026-10-25T16:00:00.000Z',
    type: 'confirmed_fall',
    status: 'active',
  }, { userId: 'fallback', userName: 'Fallback' });

  assert.equal(event?.id, 'legacy-event');
  assert.equal(event?.userId, 'patient-1');
  assert.equal(event?.userName, 'Patient One');
  assert.equal(event?.timestamp, '2026-10-25T16:00:00.000Z');
});

test('ignores malformed event values', () => {
  assert.equal(normalizeFallEvent('bad', null, { userId: 'p', userName: 'Patient' }), null);
  assert.equal(normalizeFallEvent('bad', [], { userId: 'p', userName: 'Patient' }), null);
});
