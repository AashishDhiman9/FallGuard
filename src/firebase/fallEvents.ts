import type { FallEvent } from '../types';

export interface FallEventFallbackOwner {
  userId: string;
  userName: string;
}

/** Normalize canonical patientUid records and older userId records for the UI. */
export function normalizeFallEvent(
  eventKey: string,
  rawValue: unknown,
  fallbackOwner: FallEventFallbackOwner
): FallEvent | null {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return null;

  const value = rawValue as Record<string, unknown>;
  const userId = typeof value.patientUid === 'string'
    ? value.patientUid
    : typeof value.userId === 'string'
      ? value.userId
      : fallbackOwner.userId;
  const userName = typeof value.patientName === 'string'
    ? value.patientName
    : typeof value.userName === 'string'
      ? value.userName
      : fallbackOwner.userName;
  const timestamp = typeof value.timestamp === 'number'
    ? new Date(value.timestamp).toISOString()
    : typeof value.timestamp === 'string'
      ? value.timestamp
      : new Date().toISOString();
  const acknowledgedAt = typeof value.acknowledgedAt === 'number'
    ? new Date(value.acknowledgedAt).toISOString()
    : typeof value.acknowledgedAt === 'string'
      ? value.acknowledgedAt
      : undefined;

  return {
    id: typeof value.id === 'string' ? value.id : eventKey,
    userId,
    userName,
    timestamp,
    type: value.type === 'manual_sos' || value.type === 'suspected_fall'
      ? value.type
      : 'confirmed_fall',
    status: value.status === 'acknowledged' || value.status === 'resolved'
      ? value.status
      : 'active',
    location: typeof value.location === 'string' ? value.location : undefined,
    acknowledgedAt,
    acknowledgedBy: typeof value.acknowledgedByName === 'string'
      ? value.acknowledgedByName
      : undefined,
    notes: typeof value.notes === 'string' ? value.notes : undefined,
  };
}
