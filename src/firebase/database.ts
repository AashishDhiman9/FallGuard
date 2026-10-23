import {
  ref,
  onValue,
  set,
  update,
  get,
  query,
  orderByChild,
  equalTo,
  Unsubscribe,
} from 'firebase/database';
import { database, isFirebaseConfigured } from './config';
import { DeviceInfo, FallEvent, LinkedPatient, UserProfile } from '../types';

/**
 * Subscribes to live hardware device status from `/devices/{deviceId}`.
 */
export function subscribeToDevice(
  deviceId: string | undefined,
  callback: (device: DeviceInfo | null) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !database || !deviceId) {
    callback(null);
    return () => {};
  }

  const cleanId = deviceId.trim().toUpperCase();
  const deviceRef = ref(database, `devices/${cleanId}`);

  return onValue(deviceRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback({
        id: cleanId,
        serialNumber: data.deviceId || cleanId,
        macAddress: data.macAddress || 'Hardware Pending',
        firmwareVersion: data.firmwareVersion || 'v1.0.0-PROD',
        batteryLevel: data.batteryLevel ?? undefined,
        status: data.status || 'not_connected',
        lastSync: data.lastSeen ? new Date(data.lastSeen).toISOString() : new Date().toISOString(),
        pairedUserId: data.patientUid,
      });
    } else {
      // Node does not exist yet: device has not transmitted telemetry
      callback({
        id: cleanId,
        serialNumber: cleanId,
        macAddress: 'Waiting for device data',
        firmwareVersion: 'Awaiting sync',
        status: 'not_connected',
        lastSync: new Date().toISOString(),
      });
    }
  }, (error) => {
    console.warn('Realtime Database device subscription error:', error.message);
    callback(null);
  });
}

/**
 * Subscribes to fall events from `/fall_events`.
 * If patient: filters events where patientUid === patient.id.
 * If caretaker: loads events for their assigned patients.
 */
export function subscribeToFallEvents(
  user: UserProfile,
  callback: (events: FallEvent[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !database) {
    callback([]);
    return () => {};
  }

  const eventsRef = ref(database, 'fall_events');

  if (user.role === 'user') {
    // Patient: query their own events
    const patientEventsQuery = query(eventsRef, orderByChild('patientUid'), equalTo(user.id));
    return onValue(patientEventsQuery, (snapshot) => {
      const list: FallEvent[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          list.push({
            id: child.key || val.id,
            userId: val.patientUid || user.id,
            userName: val.patientName || user.name,
            timestamp: typeof val.timestamp === 'number'
              ? new Date(val.timestamp).toISOString()
              : val.timestamp || new Date().toISOString(),
            type: val.type || 'confirmed_fall',
            status: val.status || 'active',
            location: val.location,
            acknowledgedAt: val.acknowledgedAt
              ? (typeof val.acknowledgedAt === 'number' ? new Date(val.acknowledgedAt).toISOString() : val.acknowledgedAt)
              : undefined,
            acknowledgedBy: val.acknowledgedByName,
            notes: val.notes,
          });
        });
      }
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(list);
    }, (err) => {
      console.warn('Fall events subscription error:', err.message);
      callback([]);
    });
  } else {
    // Caretaker: listen to fall events
    return onValue(eventsRef, (snapshot) => {
      const list: FallEvent[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();
          list.push({
            id: child.key || val.id,
            userId: val.patientUid,
            userName: val.patientName || 'Monitored Patient',
            timestamp: typeof val.timestamp === 'number'
              ? new Date(val.timestamp).toISOString()
              : val.timestamp || new Date().toISOString(),
            type: val.type || 'confirmed_fall',
            status: val.status || 'active',
            location: val.location,
            acknowledgedAt: val.acknowledgedAt
              ? (typeof val.acknowledgedAt === 'number' ? new Date(val.acknowledgedAt).toISOString() : val.acknowledgedAt)
              : undefined,
            acknowledgedBy: val.acknowledgedByName,
            notes: val.notes,
          });
        });
      }
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(list);
    }, (err) => {
      console.warn('Caretaker fall events subscription error:', err.message);
      callback([]);
    });
  }
}

/**
 * Subscribes to the list of patients linked to a caretaker.
 */
export function subscribeToLinkedPatients(
  caretakerUid: string,
  callback: (patients: LinkedPatient[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !database || !caretakerUid) {
    callback([]);
    return () => {};
  }

  const caretakerPatientsRef = ref(database, `caretakers/${caretakerUid}/patients`);

  return onValue(caretakerPatientsRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const patientUids = Object.keys(snapshot.val());
    if (patientUids.length === 0) {
      callback([]);
      return;
    }

    try {
      const patientsData: LinkedPatient[] = [];

      for (const pUid of patientUids) {
        const pRef = ref(database, `users/${pUid}`);
        const pSnap = await get(pRef);

        if (pSnap.exists()) {
          const pVal = pSnap.val();
          const devId = pVal.deviceId || 'Unassigned';

          // Check device status if deviceId exists
          let devStatus: LinkedPatient['deviceStatus'] = 'not_connected';
          let lastSeenIso = new Date().toISOString();

          if (pVal.deviceId) {
            const devSnap = await get(ref(database, `devices/${pVal.deviceId}`));
            if (devSnap.exists()) {
              const dData = devSnap.val();
              devStatus = dData.status || 'unknown';
              if (dData.lastSeen) {
                lastSeenIso = new Date(dData.lastSeen).toISOString();
              }
            }
          }

          patientsData.push({
            id: pUid,
            name: pVal.name || 'Patient',
            email: pVal.email || '',
            deviceId: devId,
            deviceStatus: devStatus,
            lastSeen: lastSeenIso,
            room: pVal.room || 'General Residence',
            currentStatus: 'normal',
            activeAlertCount: 0,
          });
        }
      }

      callback(patientsData);
    } catch (err) {
      console.error('Error fetching linked patient details:', err);
      callback([]);
    }
  }, (err) => {
    console.warn('Linked patients subscription error:', err.message);
    callback([]);
  });
}

/**
 * Acknowledges a fall alert in Realtime Database.
 * Complies with security rules requiring patientUid and timestamp to remain unchanged.
 */
export async function acknowledgeFallAlertInDB(params: {
  alertId: string;
  caretakerUid: string;
  caretakerName: string;
}): Promise<void> {
  if (!isFirebaseConfigured || !database) {
    throw new Error('Firebase database not configured.');
  }

  const alertRef = ref(database, `fall_events/${params.alertId}`);
  await update(alertRef, {
    status: 'acknowledged',
    acknowledgedAt: Date.now(),
    acknowledgedByUid: params.caretakerUid,
    acknowledgedByName: params.caretakerName,
  });
}

/**
 * Updates allowed user profile settings in RTDB.
 * (Role and createdAt are omitted and protected by security rules).
 */
export async function updateUserSettingsInDB(
  uid: string,
  settings: Partial<UserProfile>
): Promise<void> {
  if (!isFirebaseConfigured || !database) {
    throw new Error('Firebase database not configured.');
  }

  const safeUpdates: Record<string, unknown> = {};
  if (settings.name !== undefined) safeUpdates.name = settings.name;
  if (settings.phone !== undefined) safeUpdates.phone = settings.phone;
  if (settings.emergencyContact !== undefined) safeUpdates.emergencyContact = settings.emergencyContact;
  if (settings.caretakerName !== undefined) safeUpdates.caretakerName = settings.caretakerName;
  if (settings.caretakerEmail !== undefined) safeUpdates.caretakerEmail = settings.caretakerEmail;
  if (settings.sensitivity !== undefined) safeUpdates.sensitivity = settings.sensitivity;
  if (settings.room !== undefined) safeUpdates.room = settings.room;
  if (settings.notifications !== undefined) safeUpdates.notifications = settings.notifications;

  const userRef = ref(database, `users/${uid}`);
  await update(userRef, safeUpdates);
}

/**
 * Links a device pairing code to a patient.
 */
export async function linkDeviceToPatientInDB(
  patientUid: string,
  deviceId: string
): Promise<void> {
  if (!isFirebaseConfigured || !database) {
    throw new Error('Firebase database not configured.');
  }

  const cleanId = deviceId.trim().toUpperCase();

  // 1. Update user profile with deviceId
  const userRef = ref(database, `users/${patientUid}`);
  await update(userRef, { deviceId: cleanId });

  // 2. Initialize device node
  const devRef = ref(database, `devices/${cleanId}`);
  await set(devRef, {
    deviceId: cleanId,
    patientUid: patientUid,
    status: 'not_connected',
    lastSeen: Date.now(),
    firmwareVersion: 'Awaiting sync',
  });
}

/**
 * Links a patient to a caretaker in the database.
 */
export async function linkPatientToCaretakerInDB(
  caretakerUid: string,
  patientUid: string
): Promise<void> {
  if (!isFirebaseConfigured || !database) {
    throw new Error('Firebase database not configured.');
  }

  const linkRef = ref(database, `caretakers/${caretakerUid}/patients/${patientUid}`);
  await set(linkRef, true);
}
