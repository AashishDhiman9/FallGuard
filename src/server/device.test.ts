import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'http';
import { deviceRouter } from './deviceRoutes';
import {
  getFallEvent,
  registerLocalTestDevice,
} from './adminDb';

// Set up server environment variables for testing
process.env.FALLGUARD_DEVICE_CREDENTIALS = JSON.stringify({
  'FG-8821-X': 'valid_secret_token_8821',
  'FG-UNPAIRED-99': 'valid_secret_token_unpaired',
});

let server: Server;
let baseUrl: string;

before(async () => {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/device', deviceRouter);

  // Register local test device mappings
  registerLocalTestDevice('FG-8821-X', 'user-eleanor', 'Eleanor Vance');

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('1. Missing device credentials returns 401 Unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/device/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batteryLevel: 85 }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.code, 'MISSING_DEVICE_CREDENTIALS');
});

test('2. Invalid device secret token returns 403 Forbidden', async () => {
  const res = await fetch(`${baseUrl}/api/device/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'wrong_invalid_token',
    },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'INVALID_DEVICE_TOKEN');
});

test('3. Unregistered device returns 403 Forbidden', async () => {
  const res = await fetch(`${baseUrl}/api/device/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-UNKNOWN-00',
      'X-Device-Token': 'some_random_token',
    },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'UNREGISTERED_DEVICE');
});

test('4. Valid heartbeat updates device status and returns 200 OK', async () => {
  const res = await fetch(`${baseUrl}/api/device/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      batteryLevel: 92,
      firmwareVersion: 'v1.4.2-LTS',
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.deviceId, 'FG-8821-X');
  assert.equal(data.batteryRecorded, true);
  assert.ok(typeof data.lastSeen === 'number');
});

test('5. Reject invalid battery values (>100 or negative)', async () => {
  const res = await fetch(`${baseUrl}/api/device/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({ batteryLevel: 150 }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'INVALID_BATTERY_VALUE');
});

test('6. Reject fall event if local 15-second countdown was not completed', async () => {
  const res = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      type: 'confirmed_fall',
      countdownCompleted: false, // Cancelled or incomplete!
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'UNCONFIRMED_FALL_EVENT');
});

test('7. Reject invalid event type', async () => {
  const res = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      type: 'random_motion_noise',
      countdownCompleted: true,
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'INVALID_EVENT_TYPE');
});

test('8. Reject event from an unpaired device', async () => {
  const res = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-UNPAIRED-99',
      'X-Device-Token': 'valid_secret_token_unpaired',
    },
    body: JSON.stringify({
      type: 'confirmed_fall',
      countdownCompleted: true,
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'DEVICE_UNPAIRED');
});

test('9. Valid confirmed fall event is recorded and returns 201 Created', async () => {
  const testEventId = `TEST_EVENT_${Date.now()}`;
  const res = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      eventId: testEventId,
      type: 'confirmed_fall',
      countdownCompleted: true,
      peakAccelerationG: 2.95,
      location: 'En-suite Bathroom',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.duplicate, false);
  assert.equal(data.eventId, testEventId);
  assert.equal(data.patientUid, 'user-eleanor'); // Bound to Eleanor Vance

  // Verify record exists in server database
  const recorded = await getFallEvent(testEventId);
  assert.ok(recorded !== null);
  assert.equal(recorded?.userId, 'user-eleanor');
  assert.equal(recorded?.status, 'active');
  assert.equal(recorded?.location, 'En-suite Bathroom');
});

test('10. Client cannot forge or override patient UID (server enforces ownership)', async () => {
  const testEventId = `FORGE_TEST_${Date.now()}`;
  const res = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      eventId: testEventId,
      type: 'confirmed_fall',
      countdownCompleted: true,
      // Malicious attempt to assign this event to another user ID
      patientUid: 'user-another-victim',
      userId: 'user-another-victim',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  // Server MUST override with authorized patient Eleanor Vance!
  assert.equal(data.patientUid, 'user-eleanor');

  const recorded = await getFallEvent(testEventId);
  assert.equal(recorded?.userId, 'user-eleanor');
});

test('11. Duplicate event ID returns 200 OK without creating duplicate record (idempotency)', async () => {
  const duplicateId = `IDEMPOTENT_EVENT_${Date.now()}`;

  // Initial event submission
  const firstRes = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      eventId: duplicateId,
      type: 'confirmed_fall',
      countdownCompleted: true,
      peakAccelerationG: 3.12,
    }),
  });
  assert.equal(firstRes.status, 201);
  const firstData = await firstRes.json();
  assert.equal(firstData.duplicate, false);

  // Exact duplicate submission (e.g. Wi-Fi retry from ESP32)
  const secondRes = await fetch(`${baseUrl}/api/device/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'FG-8821-X',
      'X-Device-Token': 'valid_secret_token_8821',
    },
    body: JSON.stringify({
      eventId: duplicateId,
      type: 'confirmed_fall',
      countdownCompleted: true,
      peakAccelerationG: 3.12,
    }),
  });

  assert.equal(secondRes.status, 200);
  const secondData = await secondRes.json();
  assert.equal(secondData.status, 'ok');
  assert.equal(secondData.duplicate, true);
  assert.equal(secondData.eventId, duplicateId);
});
