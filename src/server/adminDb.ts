import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import type { FallEvent, DeviceInfo } from '../types';

let adminInitialized = false;
let adminDb: Database | null = null;

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV);
}

// Local development fallback store (in-memory) when service account key is omitted
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

const localFallbackEvents: Record<string, FallEvent> = {};

/**
 * Initializes Firebase Admin SDK if service account credentials exist.
 */
export function initFirebaseAdmin(): boolean {
  if (adminInitialized) return adminDb !== null;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const production = isProductionRuntime();
  const databaseURL = process.env.FIREBASE_DATABASE_URL || (
    production
      ? ''
      : process.env.VITE_FIREBASE_DATABASE_URL || 'https://fallguard-929ff-default-rtdb.firebaseio.com'
  );

  if (serviceAccountJson?.trim() && databaseURL) {
    try {
      const parsedAccount = JSON.parse(serviceAccountJson);
      if (getApps().length === 0) {
        initializeApp({
          credential: cert(parsedAccount),
          databaseURL,
        });
      }
      adminDb = getDatabase();
      adminInitialized = true;
      console.log('[FallGuard Admin] Firebase Admin SDK successfully connected to Realtime Database.');
      return true;
    } catch (err) {
      console.error('[FallGuard Admin] Failed to initialize Firebase Admin with provided key:', err);
    }
  }

  adminInitialized = true;
  if (production) {
    console.error('[FallGuard Admin] Firebase Admin is unavailable in production. Configure FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_DATABASE_URL.');
  } else {
    console.log('[FallGuard Admin] Running in local/test mode with deterministic database adapter.');
  }
  return false;
}

function getAdminDatabaseOrLocalFallback(): Database | null {
  initFirebaseAdmin();
  if (adminDb) return adminDb;
  if (isProductionRuntime()) {
    throw new Error('Firebase Admin is required for production device API requests. Configure FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_DATABASE_URL.');
  }
  return null;
}

/**
 * Resolves the patient bound to an authorized device ID.
 * Returns null if device is unassigned, preventing unauthorized event creation.
 */
export async function getPatientByDevice(
  deviceId: string
): Promise<{ uid: string; name: string } | null> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  const cleanId = deviceId.trim().toUpperCase();

  if (firebaseDatabase) {
    try {
      const devSnap = await firebaseDatabase.ref(`devices/${cleanId}`).once('value');
      if (!devSnap.exists()) return null;
      const devVal = devSnap.val();
      const patientUid = devVal.patientUid;
      if (!patientUid) return null;

      const userSnap = await firebaseDatabase.ref(`users/${patientUid}`).once('value');
      const userName = userSnap.exists() ? userSnap.val().name || 'Monitored Patient' : 'Monitored Patient';
      return { uid: patientUid, name: userName };
    } catch (err) {
      console.error(`[FallGuard Admin] Error resolving patient for ${cleanId}:`, err);
      if (isProductionRuntime()) throw err;
      return null;
    }
  }

  // Local fallback lookup
  const record = localFallbackDevices[cleanId];
  if (!record || !record.patientUid) return null;
  return { uid: record.patientUid, name: record.patientName };
}

/**
 * Updates device heartbeat record with server-generated timestamp.
 */
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
  if (data.batteryLevel !== undefined) {
    updates.batteryLevel = data.batteryLevel;
  }
  if (data.firmwareVersion) {
    updates.firmwareVersion = data.firmwareVersion;
  }

  if (firebaseDatabase) {
    await firebaseDatabase.ref(`devices/${cleanId}`).update(updates);
    return;
  }

  // Local fallback update
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

/**
 * Checks if a fall event with the given eventId already exists.
 * Used for strict idempotency enforcement.
 */
export async function getFallEvent(eventId: string): Promise<FallEvent | null> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  if (firebaseDatabase) {
    const snap = await firebaseDatabase.ref(`fall_events/${eventId}`).once('value');
    if (!snap.exists()) return null;
    return snap.val() as FallEvent;
  }

  return localFallbackEvents[eventId] || null;
}

/**
 * Records a verified fall event into Realtime Database.
 */
export async function recordFallEvent(event: FallEvent): Promise<void> {
  const firebaseDatabase = getAdminDatabaseOrLocalFallback();
  if (firebaseDatabase) {
    await firebaseDatabase.ref(`fall_events/${event.id}`).set(event);
    return;
  }

  localFallbackEvents[event.id] = event;
}

/**
 * Helper to register a test device in local fallback mode (used by unit tests).
 */
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
