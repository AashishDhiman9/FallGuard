import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  Wifi,
  WifiOff,
  HelpCircle,
  ShieldCheck,
  Check,
  RefreshCw,
} from 'lucide-react';
import { FallEvent, LinkedPatient } from '../types';
import {
  formatTimestamp,
  formatTimeAgo,
  getDeviceStatusConfig,
} from '../utils/monitoring';

interface CaretakerDashboardProps {
  linkedPatients: LinkedPatient[];
  events: FallEvent[];
  onAcknowledgeAlert: (alertId: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const CaretakerDashboard: React.FC<CaretakerDashboardProps> = ({
  linkedPatients,
  events,
  onAcknowledgeAlert,
  onRefresh,
  isLoading = false,
}) => {
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});

  // 3. Active fall alerts
  const activeAlerts = events.filter((e) => e.status === 'active');

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedMap((prev) => ({ ...prev, [alertId]: true }));
    onAcknowledgeAlert(alertId);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Caretaker Monitoring Station
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Roster: <span className="font-semibold text-slate-700 font-mono tabular-nums">{linkedPatients.length} Patients</span> under observation
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors self-start sm:self-auto disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-700' : 'text-slate-500'}`} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
        )}
      </div>

      {/* 3. Active Fall Alerts at the top */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Active Fall Alerts
            </h2>
            {activeAlerts.length > 0 && (
              <span className="text-xs font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded">
                {activeAlerts.length} Require Attention
              </span>
            )}
          </div>
        </div>

        {activeAlerts.length === 0 ? (
          /* Small, plain message required by specification */
          <div className="p-3 bg-white border border-slate-200 rounded text-xs text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No active alerts.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.map((alert) => {
              const isAcknowledging = acknowledgedMap[alert.id];
              return (
                <div
                  key={alert.id}
                  className="p-4 bg-rose-50 border border-rose-300 rounded text-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded">
                          {alert.type === 'confirmed_fall' ? 'Confirmed Fall' : 'Suspected Fall'}
                        </span>
                        <span className="font-semibold text-slate-900 text-sm">
                          {alert.userName}
                        </span>
                        {alert.location && (
                          <span className="text-xs text-slate-600">
                            · {alert.location}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-rose-900 mt-1">
                        Detected: <span className="font-mono tabular-nums font-medium">{formatTimestamp(alert.timestamp)}</span> ({formatTimeAgo(alert.timestamp)})
                      </div>
                      {alert.notes && (
                        <p className="text-xs text-slate-700 mt-1 italic">
                          {alert.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 4. Acknowledge button for confirmed fall alerts */}
                  <div className="shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isAcknowledging}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded transition-colors disabled:opacity-60 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isAcknowledging ? 'Acknowledged' : 'Acknowledge Alert'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1 & 2. List of Linked Users with Device Status & Last-Seen Time */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Linked Patients & Device Status
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {linkedPatients.length} linked
          </span>
        </div>

        {linkedPatients.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No linked users assigned to your caretaker profile.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Patient Name</th>
                  <th className="py-2.5 px-4 font-medium">Assigned Room / ID</th>
                  <th className="py-2.5 px-4 font-medium">Device Status</th>
                  <th className="py-2.5 px-4 font-medium">Last-Seen Time</th>
                  <th className="py-2.5 px-4 font-medium">Current Safety State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedPatients.map((patient) => {
                  const statusConfig = getDeviceStatusConfig(patient.deviceStatus);
                  const hasActiveFall = patient.currentStatus === 'fall_detected';

                  return (
                    <tr
                      key={patient.id}
                      className={hasActiveFall ? 'bg-rose-50/50' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {patient.name}
                        <div className="text-[11px] text-slate-500 font-normal">
                          {patient.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{patient.room || 'General Residence'}</div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {patient.deviceId}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                        >
                          {patient.deviceStatus === 'online' && (
                            <Wifi className="w-3 h-3 text-emerald-700" />
                          )}
                          {patient.deviceStatus === 'offline' && (
                            <WifiOff className="w-3 h-3 text-slate-500" />
                          )}
                          {patient.deviceStatus === 'unknown' && (
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                          )}
                          <span>{statusConfig.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                        <div>{patient.lastSeen ? formatTimeAgo(patient.lastSeen) : 'No telemetry yet'}</div>
                        {patient.lastSeen && (
                          <div className="text-[11px] text-slate-400">
                            {formatTimestamp(patient.lastSeen)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {hasActiveFall ? (
                          <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3 text-rose-700" />
                            <span>Fall Detected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-700" />
                            <span>Normal Monitoring</span>
                          </span>
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

      {/* 5. Recent Fall Event History */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Fall Event History
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {events.length} logged
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No incident events recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium">Patient</th>
                  <th className="py-2.5 px-4 font-medium">Incident Type</th>
                  <th className="py-2.5 px-4 font-medium">Location</th>
                  <th className="py-2.5 px-4 font-medium">Status & Acknowledgment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => {
                  const isActive = event.status === 'active';
                  const isConfirmed = event.type === 'confirmed_fall';

                  return (
                    <tr
                      key={event.id}
                      className={isActive ? 'bg-rose-50/40' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {event.userName}
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
                      <td className="py-2.5 px-4 text-slate-600">
                        {isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            Unacknowledged
                          </span>
                        ) : event.status === 'acknowledged' ? (
                          <div>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Acknowledged
                            </span>
                            {event.acknowledgedBy && (
                              <span className="text-[11px] text-slate-500 ml-1.5">
                                by {event.acknowledgedBy}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              Resolved
                            </span>
                            {event.notes && (
                              <span className="text-[11px] text-slate-500 ml-1.5">
                                · {event.notes}
                              </span>
                            )}
                          </div>
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
    </div>
  );
};
