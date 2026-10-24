import type { Request, Response } from 'express';
import { verifyDeviceAuth } from './auth.js';
import {
  getPatientByDevice,
  updateDeviceHeartbeat,
  getFallEvent,
  recordFallEvent,
} from './adminDb.js';
import type { FallEvent } from '../types.js';

/**
 * POST /api/device/heartbeat
 * Periodic status telemetry ping from ESP32-C3
 */
export async function handleDeviceHeartbeat(req: Request, res: Response): Promise<void> {
  // 1. Authenticate device
  const auth = verifyDeviceAuth(req);
  if (!auth.authenticated || !auth.deviceId) {
    res.status(auth.status || 401).json({
      status: 'error',
      code: auth.error,
      message: auth.message,
    });
    return;
  }

  const deviceId = auth.deviceId;

  // 2. Validate payload fields
  const body = req.body || {};
  let batteryLevel: number | undefined = undefined;

  // Only accept actual battery measurements if provided as valid number [0 - 100]
  if (body.batteryLevel !== undefined && body.batteryLevel !== null) {
    const parsedBattery = Number(body.batteryLevel);
    if (!isNaN(parsedBattery) && parsedBattery >= 0 && parsedBattery <= 100) {
      batteryLevel = Math.round(parsedBattery);
    } else {
      res.status(400).json({
        status: 'error',
        code: 'INVALID_BATTERY_VALUE',
        message: 'batteryLevel must be a valid number between 0 and 100.',
      });
      return;
    }
  }

  let firmwareVersion: string | undefined = undefined;
  if (typeof body.firmwareVersion === 'string') {
    firmwareVersion = body.firmwareVersion.slice(0, 32);
  }

  const serverTimestampMs = Date.now();

  try {
    // 3. Update device record in database
    await updateDeviceHeartbeat(deviceId, {
      status: 'online',
      lastSeen: serverTimestampMs,
      batteryLevel,
      firmwareVersion,
    });

    res.status(200).json({
      status: 'ok',
      message: 'Heartbeat acknowledged',
      deviceId,
      lastSeen: serverTimestampMs,
      batteryRecorded: batteryLevel !== undefined,
    });
  } catch (err) {
    console.error(`Error updating heartbeat for ${deviceId}:`, err);
    res.status(500).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'Failed to record device heartbeat telemetry.',
    });
  }
}

/**
 * POST /api/device/event
 * Confirmed fall event dispatch from ESP32-C3 after 15s local cancellation countdown
 */
export async function handleDeviceEvent(req: Request, res: Response): Promise<void> {
  // 1. Authenticate device
  const auth = verifyDeviceAuth(req);
  if (!auth.authenticated || !auth.deviceId) {
    res.status(auth.status || 401).json({
      status: 'error',
      code: auth.error,
      message: auth.message,
    });
    return;
  }

  const deviceId = auth.deviceId;
  const body = req.body || {};

  // 2. Validate payload schema
  if (!body.type || (body.type !== 'confirmed_fall' && body.type !== 'manual_sos')) {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_EVENT_TYPE',
      message: 'Event type must be either "confirmed_fall" or "manual_sos".',
    });
    return;
  }

  // Verify that the local 15-second cancellation countdown was completed
  if (body.type === 'confirmed_fall' && body.countdownCompleted !== true) {
    res.status(400).json({
      status: 'error',
      code: 'UNCONFIRMED_FALL_EVENT',
      message: 'Fall event rejected: countdownCompleted must be true to indicate the local 15-second cancellation window elapsed.',
    });
    return;
  }

  // 3. Resolve patient bound to authorized device ID
  // NEVER trust a patientUid freely supplied by incoming client requests!
  let patient: { uid: string; name: string } | null;
  try {
    patient = await getPatientByDevice(deviceId);
  } catch (err) {
    console.error(`Error resolving patient for ${deviceId}:`, err);
    res.status(500).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'Failed to resolve the device owner from the database.',
    });
    return;
  }

  if (!patient) {
    res.status(400).json({
      status: 'error',
      code: 'DEVICE_UNPAIRED',
      message: `Device ${deviceId} is not paired to any patient profile in the system. Link device in patient settings before transmitting events.`,
    });
    return;
  }

  // 4. Stable event ID & Idempotency enforcement
  // Use client-provided eventId if valid, or derive from deviceId + client timestamp
  let finalEventId: string;
  if (typeof body.eventId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.eventId.trim())) {
    finalEventId = body.eventId.trim();
  } else if (body.eventTimestamp && typeof body.eventTimestamp === 'number') {
    finalEventId = `${deviceId}_${body.eventTimestamp}`;
  } else {
    finalEventId = `${deviceId}_${Date.now()}`;
  }

  try {
    // Check if event already exists
    const existing = await getFallEvent(finalEventId);
    if (existing) {
      // Idempotent success response: do not duplicate event or alerts
      res.status(200).json({
        status: 'ok',
        duplicate: true,
        eventId: finalEventId,
        message: 'Event already recorded (idempotent duplicate request acknowledged).',
      });
      return;
    }

    // 5. Construct event record matching existing /fall_events schema
    const peakG = typeof body.peakAccelerationG === 'number' ? body.peakAccelerationG.toFixed(2) : undefined;
    const defaultNotes = peakG
      ? `Impact telemetry: deceleration reached ${peakG}g. Confirmed after 15s local window.`
      : 'Hardware incident confirmed after 15s local cancellation window.';

    const newEvent: FallEvent = {
      id: finalEventId,
      userId: patient.uid,
      userName: patient.name,
      timestamp: new Date().toISOString(),
      type: body.type,
      status: 'active',
      location: typeof body.location === 'string' ? body.location.slice(0, 64) : 'General Residence',
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 128) : defaultNotes,
    };

    // 6. Write verified event to Realtime Database
    await recordFallEvent(newEvent);

    // Also update device status as online
    await updateDeviceHeartbeat(deviceId, {
      status: 'online',
      lastSeen: Date.now(),
    });

    res.status(201).json({
      status: 'ok',
      duplicate: false,
      eventId: finalEventId,
      patientUid: patient.uid,
      patientName: patient.name,
      timestamp: newEvent.timestamp,
      message: 'Fall event verified, recorded, and dispatched to caretaker portal.',
    });
  } catch (err) {
    console.error(`Error processing fall event for ${deviceId}:`, err);
    res.status(500).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'Failed to record fall event in database.',
    });
  }
}
