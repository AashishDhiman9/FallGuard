import test from 'node:test';
import assert from 'node:assert/strict';
import type { Database } from 'firebase-admin/database';
import type { Request, Response } from 'express';
import {
  checkFirebaseAdminHealth,
  getPatientByDevice,
  setAdminDatabaseForTests,
  updateDeviceHeartbeat,
} from './adminDb.js';
import { handleHealth } from './healthRoute.js';

type Snapshot = {
  key: string | null;
  exists(): boolean;
  val(): unknown;
  forEach(callback: (child: Snapshot) => boolean | void): boolean;
};

function snapshot(key: string | null, value: unknown): Snapshot {
  return {
    key,
    exists: () => value !== null && value !== undefined,
    val: () => value,
    forEach(callback) {
      if (!value || typeof value !== 'object') return false;
      for (const [childKey, childValue] of Object.entries(value)) {
        if (callback(snapshot(childKey, childValue))) return true;
      }
      return false;
    },
  };
}

function getAt(root: Record<string, any>, path: string): any {
  if (!path) return root;
  return path.split('/').reduce((value, key) => value?.[key], root);
}

function setAt(root: Record<string, any>, path: string, value: any): void {
  const keys = path.split('/').filter(Boolean);
  if (keys.length === 0) return;
  let node = root;
  for (const key of keys.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  const lastKey = keys[keys.length - 1];
  if (value === null) delete node[lastKey];
  else node[lastKey] = value;
}

class FakeReference {
  constructor(private readonly owner: FakeDatabase, private readonly path: string) {}

  async once(): Promise<Snapshot> {
    this.owner.readPaths.push(this.path);
    return snapshot(this.path.split('/').filter(Boolean).at(-1) || null, getAt(this.owner.data, this.path) ?? null);
  }

  async update(updates: Record<string, unknown>): Promise<void> {
    this.owner.writePaths.push(this.path);
    if (!this.path) {
      for (const [relativePath, value] of Object.entries(updates)) setAt(this.owner.data, relativePath, value);
      return;
    }
    const current = getAt(this.owner.data, this.path) || {};
    const next = { ...current };
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    setAt(this.owner.data, this.path, next);
  }

  async set(value: unknown): Promise<void> {
    this.owner.writePaths.push(this.path);
    setAt(this.owner.data, this.path, value);
  }

  async transaction(updater: (value: unknown) => unknown): Promise<{ committed: boolean }> {
    const current = getAt(this.owner.data, this.path) ?? null;
    const next = updater(current);
    if (next === undefined) return { committed: false };
    setAt(this.owner.data, this.path, next);
    this.owner.writePaths.push(this.path);
    return { committed: true };
  }

  orderByChild(child: string): FakeQuery {
    return new FakeQuery(this.owner, this.path, child);
  }
}

class FakeQuery {
  private expectedValue: unknown;
  private limit = Number.POSITIVE_INFINITY;

  constructor(
    private readonly owner: FakeDatabase,
    private readonly path: string,
    private readonly child: string
  ) {}

  equalTo(value: unknown): this {
    this.expectedValue = value;
    return this;
  }

  limitToFirst(limit: number): this {
    this.limit = limit;
    return this;
  }

  async once(): Promise<Snapshot> {
    this.owner.readPaths.push(this.path);
    const records = getAt(this.owner.data, this.path) || {};
    const matching = Object.entries(records)
      .filter(([, value]) => (value as Record<string, unknown>)?.[this.child] === this.expectedValue)
      .slice(0, this.limit);
    return snapshot(null, Object.fromEntries(matching));
  }
}

class FakeDatabase {
  readonly data: Record<string, any> = {};
  readonly readPaths: string[] = [];
  readonly writePaths: string[] = [];

  ref(path = ''): FakeReference {
    return new FakeReference(this, path);
  }
}

test('heartbeat writes telemetry to /devices/{deviceId} and preserves pairing owner', async () => {
  const fake = new FakeDatabase();
  fake.data.devices = {
    'FG-8821-X': { deviceId: 'FG-8821-X', patientUid: 'patient-123', status: 'not_connected' },
  };
  setAdminDatabaseForTests(fake as unknown as Database);

  try {
    await updateDeviceHeartbeat('fg-8821-x', {
      status: 'online',
      lastSeen: 1792836000000,
      batteryLevel: 88,
      firmwareVersion: '1.0.1',
    });

    assert.deepEqual(fake.data.devices['FG-8821-X'], {
      deviceId: 'FG-8821-X',
      patientUid: 'patient-123',
      status: 'online',
      lastSeen: 1792836000000,
      batteryLevel: 88,
      firmwareVersion: '1.0.1',
    });
    assert.deepEqual(fake.writePaths, ['devices/FG-8821-X']);
  } finally {
    setAdminDatabaseForTests(undefined);
  }
});

test('device owner lookup reads /devices/{id}/patientUid then /users/{uid}', async () => {
  const fake = new FakeDatabase();
  fake.data.devices = { 'FG-8821-X': { patientUid: 'patient-123' } };
  fake.data.users = { 'patient-123': { name: 'Patient Example', role: 'user' } };
  setAdminDatabaseForTests(fake as unknown as Database);

  try {
    assert.deepEqual(await getPatientByDevice('fg-8821-x'), {
      uid: 'patient-123',
      name: 'Patient Example',
    });
    assert.deepEqual(fake.readPaths, ['devices/FG-8821-X', 'users/patient-123']);
  } finally {
    setAdminDatabaseForTests(undefined);
  }
});

test('owner lookup repairs a unique legacy /users/{uid}/deviceId mapping', async () => {
  const fake = new FakeDatabase();
  fake.data.users = {
    'patient-legacy': { name: 'Legacy Patient', role: 'user', deviceId: 'FG-8821-X' },
  };
  setAdminDatabaseForTests(fake as unknown as Database);

  try {
    assert.deepEqual(await getPatientByDevice('FG-8821-X'), {
      uid: 'patient-legacy',
      name: 'Legacy Patient',
    });
    assert.deepEqual(fake.data.devices['FG-8821-X'], {
      deviceId: 'FG-8821-X',
      patientUid: 'patient-legacy',
    });
    assert.deepEqual(fake.writePaths, ['devices/FG-8821-X']);
  } finally {
    setAdminDatabaseForTests(undefined);
  }
});

test('legacy recovery never overwrites an existing owner mapping', async () => {
  const fake = new FakeDatabase();
  fake.data.devices = { 'FG-8821-X': { patientUid: 'patient-current' } };
  fake.data.users = {
    'patient-current': { name: 'Current Patient', role: 'user' },
    'patient-legacy': { name: 'Legacy Patient', role: 'user', deviceId: 'FG-8821-X' },
  };
  setAdminDatabaseForTests(fake as unknown as Database);

  try {
    assert.deepEqual(await getPatientByDevice('FG-8821-X'), {
      uid: 'patient-current',
      name: 'Current Patient',
    });
    assert.deepEqual(fake.data.devices['FG-8821-X'], { patientUid: 'patient-current' });
    assert.deepEqual(fake.writePaths, []);
  } finally {
    setAdminDatabaseForTests(undefined);
  }
});

test('ambiguous legacy device ownership is not guessed or repaired', async () => {
  const fake = new FakeDatabase();
  fake.data.users = {
    'patient-one': { name: 'Patient One', role: 'user', deviceId: 'FG-8821-X' },
    'patient-two': { name: 'Patient Two', role: 'user', deviceId: 'FG-8821-X' },
  };
  setAdminDatabaseForTests(fake as unknown as Database);

  try {
    assert.equal(await getPatientByDevice('FG-8821-X'), null);
    assert.equal(fake.data.devices, undefined);
    assert.deepEqual(fake.writePaths, []);
  } finally {
    setAdminDatabaseForTests(undefined);
  }
});

test('health probe checks Firebase reachability and response contains no account data', async () => {
  const fake = new FakeDatabase();
  setAdminDatabaseForTests(fake as unknown as Database);

  try {
    const health = await checkFirebaseAdminHealth();
    assert.deepEqual(health, {
      firebaseAdminReady: true,
      realtimeDatabaseReachable: true,
    });
    assert.deepEqual(fake.readPaths, ['__fallguard_health_probe__']);

    let statusCode = 0;
    let body: unknown;
    const response = {
      setHeader() { return this; },
      status(code: number) { statusCode = code; return this; },
      json(value: unknown) { body = value; return this; },
    } as unknown as Response;
    await handleHealth({} as Request, response);

    assert.equal(statusCode, 200);
    assert.deepEqual(body, {
      status: 'ok',
      service: 'FallGuard API',
      checks: { firebaseAdmin: 'ready', realtimeDatabase: 'reachable' },
    });
    assert.equal(JSON.stringify(body).includes('Patient Example'), false);
    assert.equal(JSON.stringify(body).includes('patient-123'), false);
    assert.equal(JSON.stringify(body).includes('private_key'), false);
  } finally {
    setAdminDatabaseForTests(undefined);
  }
});
