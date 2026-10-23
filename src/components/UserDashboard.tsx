import React from 'react';
import {
  Activity,
  Wifi,
  WifiOff,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  PauseCircle,
  ExternalLink,
  UserCheck,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { DeviceInfo, FallDetectionStatus, FallEvent, UserProfile } from '../types';
import {
  formatTimestamp,
  formatTimeAgo,
  getDeviceStatusConfig,
  getFallStatusConfig,
} from '../utils/monitoring';

interface UserDashboardProps {
  user: UserProfile;
  device: DeviceInfo;
  events: FallEvent[];
  onNavigateToDeviceSettings: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

function deriveCurrentFallStatus(activeAlert: FallEvent | undefined): FallDetectionStatus {
  return activeAlert ? 'fall_detected' : 'normal';
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  device,
  events,
  onNavigateToDeviceSettings,
  onRefresh,
  isLoading = false,
}) => {
  // 1. Device status configuration
  const deviceConfig = getDeviceStatusConfig(device.status);

  // 2. Fall detection status configuration
  // If there's an active fall event for this user, current status is 'fall_detected'
  const activeAlert = events.find((e) => e.userId === user.id && e.status === 'active');
  const currentFallStatus = deriveCurrentFallStatus(activeAlert);
  const fallConfig = getFallStatusConfig(currentFallStatus);

  // 3. Latest fall alert (most recent event in general for this user)
  const userEvents = events.filter((e) => e.userId === user.id);
  const latestAlert = userEvents.length > 0 ? userEvents[0] : null;

  // 4. Caretaker connection status
  const hasCaretaker = Boolean(user.caretakerName);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Patient Monitoring Status
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitored Individual: <strong className="font-medium text-slate-700">{user.name}</strong> · Device ID: <span className="font-mono tabular-nums">{device.serialNumber}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-700' : 'text-slate-500'}`} />
              <span>{isLoading ? 'Updating...' : 'Check Status'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateToDeviceSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded transition-colors"
          >
            <span>Device Settings</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prominent Active Alert Notice (if fall detected) */}
      {activeAlert && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded text-rose-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-rose-900">
                Active Fall Alert Triggered
              </div>
              <p className="text-xs text-rose-800 mt-0.5">
                Impact telemetry registered at <span className="font-mono tabular-nums">{formatTimestamp(activeAlert.timestamp)}</span>
                {activeAlert.location && ` (${activeAlert.location})`}. Caretaker has been notified.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-white border border-rose-200 px-2 py-1 rounded">
            Unacknowledged
          </span>
        </div>
      )}

      {/* Unified Status Overview Panel (Avoids card-within-card clutter) */}
      <div className="bg-white border border-slate-200 rounded divide-y divide-slate-100 shadow-xs">
        {/* Row 1: Device Status & Fall Detection Status */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Device Status */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              1. Device Status
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${deviceConfig.badgeBg} ${deviceConfig.badgeText}`}
              >
                {device.status === 'online' && <Wifi className="w-3.5 h-3.5 text-emerald-700" />}
                {device.status === 'offline' && <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
                {device.status === 'unknown' && <HelpCircle className="w-3.5 h-3.5 text-slate-500" />}
                {device.status === 'not_connected' && <WifiOff className="w-3.5 h-3.5 text-slate-400" />}
                <span>{deviceConfig.label}</span>
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-600">
                {device.status === 'not_connected' ? (
                  <span>Awaiting initial telemetry packet</span>
                ) : (
                  <span>Last telemetry: <span className="tabular-nums font-medium">{formatTimeAgo(device.lastSync)}</span></span>
                )}
              </span>
            </div>
          </div>

          {/* 2. Fall-Detection Status */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              2. Fall-Detection Status
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${fallConfig.badgeBg} ${fallConfig.badgeText}`}
              >
                {currentFallStatus === 'normal' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />}
                {currentFallStatus === 'fall_detected' && <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />}
                {currentFallStatus === 'suspended' && <PauseCircle className="w-3.5 h-3.5 text-amber-700" />}
                <span>{fallConfig.label}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Latest Fall Alert & Caretaker Connection Status */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/40">
          {/* 3. Latest Fall Alert */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              3. Latest Fall Alert
            </div>
            {latestAlert ? (
              <div className="text-xs text-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {latestAlert.type === 'confirmed_fall'
                      ? 'Confirmed Fall'
                      : latestAlert.type === 'manual_sos'
                      ? 'Manual SOS Call'
                      : 'Suspected Fall'}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600 font-mono tabular-nums">
                    {formatTimestamp(latestAlert.timestamp)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: <span className="capitalize font-medium text-slate-700">{latestAlert.status}</span>
                  {latestAlert.location && ` · Location: ${latestAlert.location}`}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">
                None recorded.
              </div>
            )}
          </div>

          {/* 4. Caretaker Connection Status */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              4. Caretaker Connection Status
            </div>
            {hasCaretaker ? (
              <div className="text-xs text-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    <UserCheck className="w-3 h-3 text-emerald-700" />
                    <span>Connected</span>
                  </span>
                  <span className="font-medium text-slate-900">{user.caretakerName}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {user.caretakerEmail || 'Direct alert dispatch active'}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                No caretaker linked yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Recent Fall Event History */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              5. Recent Fall Event History
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {userEvents.length} recorded {userEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {userEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No fall events recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium">Event Type</th>
                  <th className="py-2.5 px-4 font-medium">Location</th>
                  <th className="py-2.5 px-4 font-medium">Alert Status</th>
                  <th className="py-2.5 px-4 font-medium">Caretaker Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userEvents.map((event) => {
                  const isConfirmed = event.type === 'confirmed_fall';
                  const isActive = event.status === 'active';

                  return (
                    <tr
                      key={event.id}
                      className={isActive ? 'bg-rose-50/40' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-medium ${
                            isConfirmed ? 'text-rose-700' : 'text-slate-800'
                          }`}
                        >
                          {event.type === 'confirmed_fall'
                            ? 'Confirmed Fall'
                            : event.type === 'manual_sos'
                            ? 'Manual SOS'
                            : 'Suspected Fall'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {event.location || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            Active Alert
                          </span>
                        ) : event.status === 'acknowledged' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            Acknowledged
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Resolved
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {event.acknowledgedBy ? (
                          <div>
                            <span className="font-medium text-slate-800">
                              {event.acknowledgedBy}
                            </span>
                            {event.acknowledgedAt && (
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                at {formatTimestamp(event.acknowledgedAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending response</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Simple Link to Device Settings */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs text-slate-600">
        <div>
          <span>Need to modify sensor calibration or unpair hardware? </span>
          <button
            type="button"
            onClick={onNavigateToDeviceSettings}
            className="text-teal-700 hover:text-teal-800 font-medium underline underline-offset-2 ml-1"
          >
            Go to device settings →
          </button>
        </div>
        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
          Battery: {device.batteryLevel ? `${device.batteryLevel}%` : 'N/A'}
        </span>
      </div>
    </div>
  );
};
