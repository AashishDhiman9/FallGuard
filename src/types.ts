/**
 * Core types for FallGuard healthcare monitoring application
 */

export type UserRole = 'user' | 'caretaker';

export type DeviceStatus = 'online' | 'offline' | 'unknown' | 'not_connected';

export type FallDetectionStatus = 'normal' | 'fall_detected' | 'suspended';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface UserProfile {
  id: string; // Firebase UID
  name: string;
  email: string;
  role: UserRole;
  createdAt?: number | string;
  deviceId?: string;
  caretakerName?: string;
  caretakerEmail?: string;
  caretakerUid?: string;
  phone?: string;
  emergencyContact?: string;
  sensitivity?: 'standard' | 'high' | 'assisted_living';
  room?: string;
  isDemo?: boolean;
  notifications?: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
}

export interface FallEvent {
  id: string;
  userId: string;
  userName: string;
  timestamp: string; // ISO string
  type: 'confirmed_fall' | 'suspected_fall' | 'manual_sos';
  status: AlertStatus;
  location?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  notes?: string;
}

export interface LinkedPatient {
  id: string;
  name: string;
  email: string;
  deviceId: string;
  deviceStatus: DeviceStatus;
  lastSeen: string; // ISO string or relative label
  room?: string;
  currentStatus: FallDetectionStatus;
  activeAlertCount: number;
}

export interface DeviceInfo {
  id: string;
  serialNumber: string;
  macAddress: string;
  firmwareVersion: string;
  batteryLevel?: number;
  status: DeviceStatus;
  lastSync: string;
  pairedUserId?: string;
  pairedUserName?: string;
}
