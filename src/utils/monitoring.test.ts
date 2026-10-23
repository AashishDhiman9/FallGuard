import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePairingCode,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getEventHistory,
  formatTimeAgo,
  getDeviceStatusConfig,
  getFallStatusConfig,
} from './monitoring';
import { FallEvent } from '../types';

test('validatePairingCode correctly validates FallGuard device codes', () => {
  assert.equal(validatePairingCode('FG-8821-X'), true);
  assert.equal(validatePairingCode('fg-8821-x'), true); // case insensitive
  assert.equal(validatePairingCode('FG-1234'), true);
  assert.equal(validatePairingCode('FG-ABCD-12'), true);

  assert.equal(validatePairingCode(''), false);
  assert.equal(validatePairingCode('INVALID'), false);
  assert.equal(validatePairingCode('12345'), false);
  assert.equal(validatePairingCode('FG-'), false);
});

test('getActiveAlerts filters only active alerts and optionally by user', () => {
  const events: FallEvent[] = [
    {
      id: 'e1',
      userId: 'u1',
      userName: 'Eleanor',
      timestamp: '2026-10-22T20:00:00Z',
      type: 'confirmed_fall',
      status: 'active',
    },
    {
      id: 'e2',
      userId: 'u1',
      userName: 'Eleanor',
      timestamp: '2026-10-22T19:00:00Z',
      type: 'confirmed_fall',
      status: 'acknowledged',
    },
    {
      id: 'e3',
      userId: 'u2',
      userName: 'Harold',
      timestamp: '2026-10-22T20:10:00Z',
      type: 'suspected_fall',
      status: 'active',
    },
  ];

  const allActive = getActiveAlerts(events);
  assert.equal(allActive.length, 2);
  assert.deepEqual(allActive.map((e) => e.id), ['e1', 'e3']);

  const u1Active = getActiveAlerts(events, 'u1');
  assert.equal(u1Active.length, 1);
  assert.equal(u1Active[0].id, 'e1');
});

test('acknowledgeAlert marks alert as acknowledged with timestamp and caretaker', () => {
  const events: FallEvent[] = [
    {
      id: 'e1',
      userId: 'u1',
      userName: 'Eleanor',
      timestamp: '2026-10-22T20:00:00Z',
      type: 'confirmed_fall',
      status: 'active',
    },
  ];

  const updated = acknowledgeAlert(events, 'e1', 'Dr. Marcus Chen', '2026-10-22T20:05:00Z');
  assert.equal(updated[0].status, 'acknowledged');
  assert.equal(updated[0].acknowledgedBy, 'Dr. Marcus Chen');
  assert.equal(updated[0].acknowledgedAt, '2026-10-22T20:05:00Z');
});

test('resolveAlert marks alert as resolved', () => {
  const events: FallEvent[] = [
    {
      id: 'e1',
      userId: 'u1',
      userName: 'Eleanor',
      timestamp: '2026-10-22T20:00:00Z',
      type: 'confirmed_fall',
      status: 'acknowledged',
    },
  ];

  const updated = resolveAlert(events, 'e1');
  assert.equal(updated[0].status, 'resolved');
});

test('getEventHistory orders events descending by timestamp', () => {
  const events: FallEvent[] = [
    {
      id: 'e1',
      userId: 'u1',
      userName: 'Eleanor',
      timestamp: '2026-10-22T10:00:00Z',
      type: 'confirmed_fall',
      status: 'resolved',
    },
    {
      id: 'e2',
      userId: 'u1',
      userName: 'Eleanor',
      timestamp: '2026-10-22T12:00:00Z',
      type: 'confirmed_fall',
      status: 'resolved',
    },
  ];

  const sorted = getEventHistory(events);
  assert.equal(sorted[0].id, 'e2');
  assert.equal(sorted[1].id, 'e1');
});

test('formatTimeAgo computes clean human-readable relative time', () => {
  const now = new Date('2026-10-22T20:30:00Z').getTime();
  const thirtySecAgo = '2026-10-22T20:29:40Z';
  const fiveMinAgo = '2026-10-22T20:25:00Z';
  const twoHoursAgo = '2026-10-22T18:30:00Z';

  assert.equal(formatTimeAgo(thirtySecAgo, now), 'Just now');
  assert.equal(formatTimeAgo(fiveMinAgo, now), '5m ago');
  assert.equal(formatTimeAgo(twoHoursAgo, now), '2h ago');
});

test('getDeviceStatusConfig and getFallStatusConfig return compliant labels', () => {
  const onlineConfig = getDeviceStatusConfig('online');
  assert.equal(onlineConfig.label, 'Online');
  assert.match(onlineConfig.badgeBg, /emerald/);

  const unknownConfig = getDeviceStatusConfig('unknown');
  assert.equal(unknownConfig.label, 'Unknown');
  assert.match(unknownConfig.badgeBg, /slate/);

  const notConnectedConfig = getDeviceStatusConfig('not_connected');
  assert.equal(notConnectedConfig.label, 'Waiting for device data');
  assert.match(notConnectedConfig.badgeBg, /slate/);

  const fallConfig = getFallStatusConfig('fall_detected');
  assert.match(fallConfig.badgeBg, /rose/);
});
