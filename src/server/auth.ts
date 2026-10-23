import crypto from 'crypto';
import type { Request } from 'express';

export interface DeviceAuthResult {
  authenticated: boolean;
  deviceId?: string;
  status?: number;
  error?: string;
  message?: string;
}

/**
 * Loads device credentials map from server environment.
 * Maps normalized uppercase Device ID -> Pre-shared Secret Token.
 */
export function getDeviceCredentials(): Record<string, string> {
  const envVal = process.env.FALLGUARD_DEVICE_CREDENTIALS;
  if (!envVal) return {};

  try {
    const parsed = JSON.parse(envVal);
    const normalized: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'string') {
        normalized[key.trim().toUpperCase()] = val;
      }
    }
    return normalized;
  } catch (err) {
    console.error('Failed to parse FALLGUARD_DEVICE_CREDENTIALS environment variable:', err);
    return {};
  }
}

/**
 * Constant-time safe token comparison to guard against timing attacks.
 */
export function safeCompareTokens(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Authenticates an incoming device request.
 * Checks for X-Device-Id and X-Device-Token headers (or Bearer token / body payload).
 */
export function verifyDeviceAuth(req: Request): DeviceAuthResult {
  const headerDeviceId = (req.headers['x-device-id'] as string) || '';
  const headerDeviceToken = (req.headers['x-device-token'] as string) || '';

  // Also support Bearer authorization header
  let bearerToken = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  // Fallback to request body if headers are not set
  const bodyDeviceId = (req.body && req.body.deviceId) || '';
  const bodyDeviceToken = (req.body && req.body.deviceToken) || '';

  const rawDeviceId = (headerDeviceId || bodyDeviceId).toString().trim();
  const rawToken = (headerDeviceToken || bearerToken || bodyDeviceToken).toString().trim();

  if (!rawDeviceId || !rawToken) {
    return {
      authenticated: false,
      status: 401,
      error: 'MISSING_DEVICE_CREDENTIALS',
      message: 'Both device ID and device authentication token are required.',
    };
  }

  const deviceId = rawDeviceId.toUpperCase();
  const credentials = getDeviceCredentials();
  const expectedToken = credentials[deviceId];

  if (!expectedToken) {
    return {
      authenticated: false,
      status: 403,
      error: 'UNREGISTERED_DEVICE',
      message: `Device ${deviceId} is not registered in the server credentials registry.`,
    };
  }

  if (!safeCompareTokens(expectedToken, rawToken)) {
    return {
      authenticated: false,
      status: 403,
      error: 'INVALID_DEVICE_TOKEN',
      message: 'Authentication failed: Invalid device secret token.',
    };
  }

  return {
    authenticated: true,
    deviceId,
  };
}
