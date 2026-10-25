import { auth } from './config';
import type { LinkedPatient } from '../types';

interface LinkResponse {
  status: 'ok';
  patient: {
    id: string;
    name: string;
    email: string;
    deviceId: string;
    room: string;
    deviceStatus: string;
    lastSeen?: number;
  };
}

/** Link an existing, consenting patient through the authenticated server API. */
export async function linkPatientToCaretaker(
  patientEmail: string,
  deviceId: string
): Promise<LinkedPatient> {
  const signedInUser = auth?.currentUser;
  if (!signedInUser) throw new Error('Sign in again before linking a patient.');

  const token = await signedInUser.getIdToken();
  const response = await fetch('/api/caretaker/link-patient', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ patientEmail: patientEmail.trim(), deviceId: deviceId.trim() }),
  });

  const result = await response.json().catch(() => null) as
    | LinkResponse
    | { message?: string }
    | null;
  if (!response.ok || !result || !('patient' in result)) {
    throw new Error(
      result && 'message' in result && typeof result.message === 'string'
        ? result.message
        : 'Patient linking failed. Please retry.'
    );
  }

  const patient = result.patient;
  return {
    ...patient,
    deviceStatus: ['online', 'offline', 'unknown', 'not_connected'].includes(patient.deviceStatus)
      ? patient.deviceStatus as LinkedPatient['deviceStatus']
      : 'unknown',
    lastSeen: patient.lastSeen ? new Date(patient.lastSeen).toISOString() : '',
    currentStatus: 'normal',
    activeAlertCount: 0,
  };
}
