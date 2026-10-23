import { AlertStatus, DeviceStatus, FallDetectionStatus, FallEvent } from '../types';

/**
 * Validates a FallGuard device pairing code.
 * Expected format: FG-XXXX-X or FG-XXXX (case-insensitive alphanumeric).
 */
export function validatePairingCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim().toUpperCase();
  const pattern = /^FG-[A-Z0-9]{4}(-[A-Z0-9]{1,4})?$/;
  return pattern.test(trimmed);
}

/**
 * Acknowledges an active fall alert.
 */
export function acknowledgeAlert(
  events: FallEvent[],
  alertId: string,
  caretakerName: string,
  nowIso: string = new Date().toISOString()
): FallEvent[] {
  return events.map((event) => {
    if (event.id === alertId && event.status === 'active') {
      return {
        ...event,
        status: 'acknowledged' as AlertStatus,
        acknowledgedAt: nowIso,
        acknowledgedBy: caretakerName,
      };
    }
    return event;
  });
}

/**
 * Resolves a fall alert after patient has been assisted.
 */
export function resolveAlert(
  events: FallEvent[],
  alertId: string
): FallEvent[] {
  return events.map((event) => {
    if (event.id === alertId) {
      return {
        ...event,
        status: 'resolved' as AlertStatus,
      };
    }
    return event;
  });
}

/**
 * Filters for active (unacknowledged/unresolved) fall alerts.
 */
export function getActiveAlerts(events: FallEvent[], userId?: string): FallEvent[] {
  return events.filter((e) => {
    const matchesUser = userId ? e.userId === userId : true;
    return matchesUser && e.status === 'active';
  });
}

/**
 * Returns event history sorted with most recent first.
 */
export function getEventHistory(events: FallEvent[], userId?: string): FallEvent[] {
  return events
    .filter((e) => (userId ? e.userId === userId : true))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Formats an ISO date into a clean, human-readable medical log timestamp.
 * Example: "Oct 22, 2026 at 20:42"
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats a short time representation (e.g., "14:32:05").
 */
export function formatTimeOnly(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Returns human-readable relative duration string (e.g. "4m ago", "1h ago", "Just now").
 */
export function formatTimeAgo(isoString: string, currentTimestamp?: number): string {
  try {
    const date = new Date(isoString);
    const now = currentTimestamp ?? Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return isoString;
  }
}

/**
 * Semantic styling for device status: muted green for normal/online,
 * neutral grey for unknown, and amber/red for offline.
 */
export function getDeviceStatusConfig(status: DeviceStatus): {
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
} {
  switch (status) {
    case 'online':
      return {
        label: 'Online',
        badgeBg: 'bg-emerald-50 border-emerald-200',
        badgeText: 'text-emerald-800',
        dotColor: 'bg-emerald-600',
      };
    case 'offline':
      return {
        label: 'Offline',
        badgeBg: 'bg-slate-100 border-slate-300',
        badgeText: 'text-slate-700',
        dotColor: 'bg-slate-400',
      };
    case 'not_connected':
      return {
        label: 'Waiting for device data',
        badgeBg: 'bg-slate-100 border-slate-200',
        badgeText: 'text-slate-600',
        dotColor: 'bg-slate-400',
      };
    case 'unknown':
    default:
      return {
        label: 'Unknown',
        badgeBg: 'bg-slate-100 border-slate-200',
        badgeText: 'text-slate-600',
        dotColor: 'bg-slate-400',
      };
  }
}

/**
 * Semantic styling for fall detection state.
 * Uses red ONLY for confirmed falls or critical alerts.
 */
export function getFallStatusConfig(status: FallDetectionStatus): {
  label: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  switch (status) {
    case 'normal':
      return {
        label: 'Normal · Active Monitoring',
        badgeBg: 'bg-emerald-50 border-emerald-200',
        badgeText: 'text-emerald-800',
        description: 'No fall anomalies detected. Accelerometer telemetry nominal.',
      };
    case 'fall_detected':
      return {
        label: 'Fall Detected · Alert Active',
        badgeBg: 'bg-rose-50 border-rose-300',
        badgeText: 'text-rose-800',
        description: 'Sudden deceleration impact registered. Caretaker notified.',
      };
    case 'suspended':
      return {
        label: 'Monitoring Paused',
        badgeBg: 'bg-amber-50 border-amber-200',
        badgeText: 'text-amber-800',
        description: 'Fall detection temporarily paused by user or during charging.',
      };
  }
}
