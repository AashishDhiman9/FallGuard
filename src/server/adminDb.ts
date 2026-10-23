import admin from 'firebase-admin';
import type { FallEvent, DeviceInfo } from '../types';

let adminInitialized = false;
let adminDb: admin.database.Database | null = null;

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
  const databaseURL =
    process.env.VITE_FIREBASE_DATABASE_URL ||
    'https://fallguard-929ff-default-rtdb.firebaseio.com';

  if (serviceAccountJson && serviceAccountJson.trim() !== '') {
    try {
      const parsedAccount = JSON.parse(serviceAccountJson);
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(parsedAccount),
          databaseURL,
        });
      }
      adminDb = admin.database();
      adminInitialized = true;
      console.log('[FallGuard Admin] Firebase Admin SDK successfully connected to Realtime Database.');
      return true;
    } catch (err) {
      console.error('[FallGuard Admin] Failed to initialize Firebase Admin with provided key:', err);
    }
  }

  adminInitialized = true;
  console.log('[FallGuard Admin] Running in local/test mode with deterministic database adapter.');
  return false;
}

/**
 * Resolves the patient bound to an authorized device ID.
 * Returns null if device is unassigned, preventing unauthorized event creation.
 */
export async function getPatientByDevice(
  deviceId: string
): Promise<{ uid: string; name: string } | null> {
  initFirebaseAdmin();
  const cleanId = deviceId.trim().toUpperCase();

  if (adminDb) {
    try {
      const devSnap = await adminDb.ref(`devices/${cleanId}`).once('value');
      if (!devSnap.exists()) return null;
      const devVal = devSnap.val();
      const patientUid = devVal.patientUid;
      if (!patientUid) return null;

      const userSnap = await adminDb.ref(`users/${patientUid}`).once('value');
      const userName = userSnap.exists() ? userSnap.val().name || 'Monitored Patient' : 'Monitored Patient';
      return { uid: patientUid, name: userName };
    } catch (err) {
      console.error(`[FallGuard Admin] Error resolving patient for ${cleanId}:`, err);
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
  initFirebaseAdmin();
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

  if (adminDb) {
    await adminDb.ref(`devices/${cleanId}`).update(updates);
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
  initFirebaseAdmin();
  if (adminDb) {
    const snap = await adminDb.ref(`fall_events/${eventId}`).once('value');
    if (!snap.exists()) return null;
    return snap.val() as FallEvent;
  }

  return localFallbackEvents[eventId] || null;
}

/**
 * Records a verified fall event into Realtime Database.
 */
export async function recordFallEvent(event: FallEvent): Promise<void> {
  initFirebaseAdmin();
  if (adminDb) {
    await adminDb.ref(`fall_events/${event.id}`).set(event);
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
  localFallbackDevices[deviceId.trim().toUpperCase()] = {
    deviceId: deviceId.trim().toUpperCase(),
    patientUid,
    patientName,
    status: 'online',
    lastSeen: Date.now(),
  };
}
