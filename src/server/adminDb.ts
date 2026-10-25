import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import type { FallEvent } from '../types.js';

const FIREBASE_PROJECT_ID = 'fallguard-929ff';
export const FIREBASE_DATABASE_URL =
  'https://fallguard-929ff-default-rtdb.asia-southeast1.firebasedatabase.app';

export interface StoredFallEvent {
  id: string;
  patientUid: string;
  patientName: string;
  timestamp: string;
  type: FallEvent['type'];
  status: FallEvent['status'];
  location?: string;
  notes?: string;
  acknowledgedAt?: string | number;
  acknowledgedByUid?: string;
  acknowledgedByName?: string;
}

export interface FirebaseAdminHealth {
  firebaseAdminReady: boolean;
  realtimeDatabaseReachable: boolean;
}

let adminInitialized = false;
let adminDb: Database | null = null;
let testDatabaseOverride: Database | null | undefined;

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV);
}

function safeFirebaseErrorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[a-zA-Z0-9/_-]{1,64}$/.test(code)
    ? code
    : 'unclassified';
}

/** Log only a Firebase error code; messages and stacks can contain URLs or credentials. */
export function logFirebaseError(operation: string, err: unknown): void {
  console.error(`[FallGuard Admin] ${operation} failed.`, {
    code: safeFirebaseErrorCode(err),
  });
}

function failInitialization(reason: string): false {
  adminInitialized = true;
  adminDb = null;
  console.error('[FallGuard Admin] Firebase Admin initialization failed.', { reason });
  return false;
}

function isCanonicalDatabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' &&
      parsed.origin === FIREBASE_DATABASE_URL &&
      (parsed.pathname === '/' || parsed.pathname === '') &&
      !parsed.search &&
      !parsed.hash;
  } catch {
    return false;
  }
}

/**
 * Initializes Admin from server-only Vercel variables. Production deliberately
 * requires both values and the region-specific database URL; it never falls
 * back to the local in-memory adapter.
 */
export function initFirebaseAdmin(): boolean {
  if (adminInitialized) return adminDb !== null;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  const databaseUrl = process.env.FIREBASE_DATABASE_URL?.trim();
  const production = isProductionRuntime();

  if (!serviceAccountJson || !databaseUrl) {
    adminInitialized = true;
    if (production) {
      console.error('[FallGuard Admin] Missing required Firebase Admin configuration.', {
        serviceAccountConfigured: Boolean(serviceAccountJson),
        databaseUrlConfigured: Boolean(databaseUrl),
      });
    } else {
      console.info('[FallGuard Admin] Firebase Admin is not configured; using the local test adapter.');
    }
    return false;
  }

  if (!isCanonicalDatabaseUrl(databaseUrl)) {
    return failInitialization('incorrect_realtime_database_url');
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  } catch {
    return failInitialization('invalid_service_account_json');
  }

  if (
    serviceAccount.project_id !== FIREBASE_PROJECT_ID ||
    typeof serviceAccount.client_email !== 'string' ||
    typeof serviceAccount.private_key !== 'string' ||
    !serviceAccount.private_key.includes('PRIVATE KEY')
  ) {
    return failInitialization('invalid_or_wrong_project_service_account');
  }

  try {
    const existingApp = getApps().find((app) => app.name === '[DEFAULT]');
    const app = existingApp || initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      databaseURL: FIREBASE_DATABASE_URL,
      projectId: FIREBASE_PROJECT_ID,
    });

    if (
      app.options.projectId !== FIREBASE_PROJECT_ID ||
      !isCanonicalDatabaseUrl(app.options.databaseURL || '')
    ) {
      return failInitialization('existing_firebase_app_configuration_mismatch');
    }

    adminDb = getDatabase(app);
    adminInitialized = true;
    console.info('[FallGuard Admin] Firebase Admin SDK initialized for the configured project.');
    return true;
  } catch (err) {
    logFirebaseError('Firebase Admin initialization', err);
    return failInitialization('firebase_admin_sdk_initialization_failed');
  }
}

function getAdminDatabaseOrLocalFallback(): Database | null {
  if (testDatabaseOverride !== undefined && !isProductionRuntime()) {
    return testDatabaseOverride;
  }

  initFirebaseAdmin();
  if (adminDb) return adminDb;
  if (isProductionRuntime()) {
    throw new Error('Firebase Admin is required for production device API requests.');
  }
  return null;
}

/**
 * Read-only connection probe used by /api/health. It returns only booleans and
 * never reads patient records or includes configuration values in its result.
 */
export async function checkFirebaseAdminHealth(): Promise<FirebaseAdminHealth> {
  let firebaseDatabase: Database | null;
  try {
    firebaseDatabase = getAdminDatabaseOrLocalFallback();
  } catch {
    return { firebaseAdminReady: false, realtimeDatabaseReachable: false };
  }

  if (!firebaseDatabase) {
    return { firebaseAdminReady: false, realtimeDatabaseReachable: false };
  }

  try {
    // A fixed, reserved, read-only path forces a real database request. The
    // special .info tree can be served from local SDK state without a network trip.
    await firebaseDatabase.ref('__fallguard_health_probe__').once('value');
    return { firebaseAdminReady: true, realtimeDatabaseReachable: true };
  } catch (err) {
    logFirebaseError('Realtime Database health probe', err);
    return { firebaseAdminReady: true, realtimeDatabaseReachable: false };
  }
}

// Local development fallback store. This is never selected in production.
const localFallbackDevices: Record<string, {
  deviceId: string;
  patientUid: string;
  patientName: string;
  status: string;
  lastSeen: number;
  batteryLevel?: number;
}> = {
  'FG-8821-X': {
    deviceId: 'FG-8821-X',
    patientUid: 'user-eleanor',
    patientName: 'Eleanor Vance',
    status: 'online',
    lastSeen: Date.now(),
  },
  'FG-4102-Y': {
    deviceId: 'FG-4102-Y',
    patientUid: 'user-harold',
    patientName: 'Harold Miller',
    status: 'offline',
    lastSeen: Date.now() - 3600000,
  },
};

const localFallbackEvents: Record<string, StoredFallEvent> = {};

/**
 * Resolves the patient bound to an authorized device ID.
 * Canonical mapping: /devices/{deviceId}/patientUid. For older profiles that
 * only have /users/{uid}/deviceId, discover a unique match and repair the
 * canonical mapping without replacing an existing owner's mapping.
 */
export async function getPatientByDevice(
  deviceId: string
): Promise<{ uid: string; name: string } | null> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  const cleanId = deviceId.trim().toUpperCase();

  if (firebaseDatabase) {
    try {
      const devSnap = await firebaseDatabase.ref(`devices/${cleanId}`).once('value');
      const devVal = devSnap.val() as { patientUid?: unknown } | null;
      let patientUid = typeof devVal?.patientUid === 'string' ? devVal.patientUid : '';

      if (!patientUid) {
        const legacyMatches = await firebaseDatabase.ref('users')
          .orderByChild('deviceId')
          .equalTo(cleanId)
          .limitToFirst(2)
          .once('value');

        const matches: Array<{ uid: string; value: Record<string, unknown> }> = [];
        legacyMatches.forEach((child) => {
          matches.push({
            uid: child.key || '',
            value: (child.val() || {}) as Record<string, unknown>,
          });
          return matches.length >= 2;
        });

        if (matches.length !== 1 || !matches[0].uid) return null;
        patientUid = matches[0].uid;

        const repaired = await firebaseDatabase.ref(`devices/${cleanId}`).transaction((current) => {
          const currentValue = (current || {}) as { patientUid?: string } & Record<string, unknown>;
          if (currentValue.patientUid && currentValue.patientUid !== patientUid) return;
          return {
            ...currentValue,
            deviceId: cleanId,
            patientUid,
          };
        });
        if (!repaired.committed) return null;
      }

      const userSnap = await firebaseDatabase.ref(`users/${patientUid}`).once('value');
      if (!userSnap.exists()) return null;
      const user = (userSnap.val() || {}) as { name?: unknown; role?: unknown };
      if (user.role && user.role !== 'user') return null;

      return {
        uid: patientUid,
        name: typeof user.name === 'string' && user.name.trim()
          ? user.name
          : 'Monitored Patient',
      };
    } catch (err) {
      logFirebaseError('device owner lookup', err);
      if (isProductionRuntime()) throw err;
      return null;
    }
  }

  const record = localFallbackDevices[cleanId];
  if (!record || !record.patientUid) return null;
  return { uid: record.patientUid, name: record.patientName };
}

/** Updates only telemetry fields under /devices/{deviceId}, preserving pairing ownership. */
export async function updateDeviceHeartbeat(
  deviceId: string,
  data: {
    status: 'online' | 'offline';
    lastSeen: number;
    batteryLevel?: number;
    firmwareVersion?: string;
  }
): Promise<void> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  const cleanId = deviceId.trim().toUpperCase();

  const updates: Record<string, unknown> = {
    status: data.status,
    lastSeen: data.lastSeen,
  };
  if (data.batteryLevel !== undefined) updates.batteryLevel = data.batteryLevel;
  if (data.firmwareVersion) updates.firmwareVersion = data.firmwareVersion;

  if (firebaseDatabase) {
    await firebaseDatabase.ref(`devices/${cleanId}`).update(updates);
    return;
  }

  if (!localFallbackDevices[cleanId]) {
    localFallbackDevices[cleanId] = {
      deviceId: cleanId,
      patientUid: '',
      patientName: 'Unassigned',
      status: data.status,
      lastSeen: data.lastSeen,
      batteryLevel: data.batteryLevel,
    };
  } else {
    localFallbackDevices[cleanId].status = data.status;
    localFallbackDevices[cleanId].lastSeen = data.lastSeen;
    if (data.batteryLevel !== undefined) {
      localFallbackDevices[cleanId].batteryLevel = data.batteryLevel;
    }
  }
}

/** Checks /fall_events/{eventId} for idempotent event handling. */
export async function getFallEvent(eventId: string): Promise<StoredFallEvent | null> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  if (firebaseDatabase) {
    const snap = await firebaseDatabase.ref(`fall_events/${eventId}`).once('value');
    if (!snap.exists()) return null;
    return snap.val() as StoredFallEvent;
  }

  return localFallbackEvents[eventId] || null;
}

/** Records a verified event under /fall_events/{eventId}, matching rules and UI queries. */
export async function recordFallEvent(event: StoredFallEvent): Promise<void> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  if (firebaseDatabase) {
    await firebaseDatabase.ref(`fall_events/${event.id}`).set(event);
    return;
  }

  localFallbackEvents[event.id] = event;
}

/** Test-only database injection for exercising the real path logic without cloud writes. */
export function setAdminDatabaseForTests(database: Database | null | undefined): void {
  if (isProductionRuntime()) {
    throw new Error('Test database injection is unavailable in production.');
  }
  testDatabaseOverride = database;
}

/** Registers a local test device in the development-only in-memory store. */
export function registerLocalTestDevice(
  deviceId: string,
  patientUid: string,
  patientName: string
) {
  if (isProductionRuntime()) {
    throw new Error('Local fallback devices are only available outside production.');
  }
  localFallbackDevices[deviceId.trim().toUpperCase()] = {
    deviceId: deviceId.trim().toUpperCase(),
    patientUid,
    patientName,
    status: 'online',
    lastSeen: Date.now(),
  };
}
