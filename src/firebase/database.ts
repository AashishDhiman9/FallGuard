import {
  ref,
  onValue,
  update,
  get,
  query,
  orderByChild,
  equalTo,
} from 'firebase/database';
import type { DataSnapshot, Query, Unsubscribe } from 'firebase/database';
import { database, isFirebaseConfigured } from './config';
import { DeviceInfo, FallEvent, LinkedPatient, UserProfile } from '../types';
import { normalizeFallEvent } from './fallEvents';

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
  const ownerName = user.role === 'user' ? user.name : 'Monitored Patient';
  const queryResults = new Map<string, FallEvent[]>();
  const emitMergedEvents = () => {
    const eventsById = new Map<string, FallEvent>();
    for (const events of queryResults.values()) {
      for (const event of events) eventsById.set(event.id, event);
    }
    callback([...eventsById.values()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  };
  const subscribeToOwnerQueries = (
    ownerIds: string[],
    isCurrentGeneration: () => boolean
  ): Unsubscribe[] => {
    const subscriptions: Unsubscribe[] = [];
    for (const ownerId of ownerIds) {
      for (const ownerField of ['patientUid', 'userId'] as const) {
        const key = `${ownerId}:${ownerField}`;
        const ownerQuery: Query = query(eventsRef, orderByChild(ownerField), equalTo(ownerId));
        subscriptions.push(onValue(ownerQuery, (snapshot) => {
          if (!isCurrentGeneration()) return;
          queryResults.set(key, fallEventsFromSnapshot(snapshot, { userId: ownerId, userName: ownerName }));
          emitMergedEvents();
        }, (err) => {
          if (!isCurrentGeneration()) return;
          console.warn('Fall events subscription error:', err.message);
          queryResults.set(key, []);
          emitMergedEvents();
        }));
      }
    }
    return subscriptions;
  };

  if (user.role === 'user') {
    // Keep both canonical patientUid records and legacy userId records.
    const subscriptions = subscribeToOwnerQueries([user.id], () => true);
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }

  // A caretaker may only query events for explicitly linked patient IDs.
  const linkedPatientsRef = ref(database, `caretakers/${user.id}/patients`);
  let generation = 0;
  let eventSubscriptions: Unsubscribe[] = [];
  const unsubscribeLinks = onValue(linkedPatientsRef, (snapshot) => {
    const currentGeneration = ++generation;
    eventSubscriptions.forEach((unsubscribe) => unsubscribe());
    eventSubscriptions = [];
    queryResults.clear();

    const ownerIds: string[] = [];
    snapshot.forEach((child) => {
      if (child.val() === true && child.key) ownerIds.push(child.key);
      return false;
    });
    if (ownerIds.length === 0) {
      callback([]);
      return;
    }

    eventSubscriptions = subscribeToOwnerQueries(
      ownerIds,
      () => generation === currentGeneration
    );
  }, (err) => {
    console.warn('Caretaker patient subscription error:', err.message);
    callback([]);
  });

  return () => {
    generation += 1;
    unsubscribeLinks();
    eventSubscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

function fallEventsFromSnapshot(
  snapshot: DataSnapshot,
  fallbackOwner: { userId: string; userName: string }
): FallEvent[] {
  const events: FallEvent[] = [];
  snapshot.forEach((child) => {
    const event = normalizeFallEvent(child.key || '', child.val(), fallbackOwner);
    if (event) events.push(event);
    return false;
  });
  return events;
}

/**
 * Subscribes to the list of patients linked to a caretaker.
 */
export function subscribeToLinkedPatients(
  caretakerUid: string,
  callback: (patients: LinkedPatient[]) => void
): Unsubscribe {
  const firebaseDatabase = database;
  if (!isFirebaseConfigured || !firebaseDatabase || !caretakerUid) {
    callback([]);
    return () => {};
  }

  const caretakerPatientsRef = ref(firebaseDatabase, `caretakers/${caretakerUid}/patients`);

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
        const pRef = ref(firebaseDatabase, `users/${pUid}`);
        const pSnap = await get(pRef);

        if (pSnap.exists()) {
          const pVal = pSnap.val();
          const devId = pVal.deviceId || 'Unassigned';

          // Check device status if deviceId exists
          let devStatus: LinkedPatient['deviceStatus'] = 'not_connected';
          let lastSeenIso = new Date().toISOString();

          if (pVal.deviceId) {
            const devSnap = await get(ref(firebaseDatabase, `devices/${pVal.deviceId}`));
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
  if (!/^FG-[A-Z0-9]{4}(-[A-Z0-9]{1,4})?$/.test(cleanId)) {
    throw new Error('Invalid FallGuard device pairing code.');
  }

  const userRef = ref(database, `users/${patientUid}`);
  const userSnap = await get(userRef);
  if (!userSnap.exists()) {
    throw new Error('Patient profile not found; device was not paired.');
  }

  const user = userSnap.val();
  if (user.role && user.role !== 'user') {
    throw new Error('Only a patient profile can own a monitoring device.');
  }

  // Keep the profile and canonical owner map in sync in one atomic RTDB update.
  // Updating just these fields preserves existing telemetry. The database write
  // rule rejects an ID that is already owned by another patient, without
  // requiring an unpaired device to be readable by the patient.
  const updates: Record<string, unknown> = {
    [`users/${patientUid}/deviceId`]: cleanId,
    [`devices/${cleanId}/deviceId`]: cleanId,
    [`devices/${cleanId}/patientUid`]: patientUid,
  };
  await update(ref(database), updates);
}
