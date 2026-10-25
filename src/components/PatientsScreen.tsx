import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Wifi,
  WifiOff,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { LinkedPatient } from '../types';
import { formatTimeAgo, formatTimestamp, getDeviceStatusConfig, validatePairingCode } from '../utils/monitoring';

interface PatientsScreenProps {
  patients: LinkedPatient[];
  onAddPatient: (patient: { email: string; deviceId: string }) => Promise<LinkedPatient>;
  onBackToDashboard: () => void;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  patients,
  onAddPatient,
  onBackToDashboard,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Enter the email address used by the patient’s FallGuard account.');
      return;
    }

    const code = deviceId.trim().toUpperCase();
    if (!code || !validatePairingCode(code)) {
      setError('Please provide a valid device code format (e.g. FG-5520-B).');
      return;
    }

    setIsSubmitting(true);
    try {
      const linkedPatient = await onAddPatient({ email: email.trim(), deviceId: code });
      setSuccess(`${linkedPatient.name} is linked to ${linkedPatient.deviceId}.`);
      setEmail('');
      setDeviceId('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Patient linking failed. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Linked Patients Roster
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active patient monitoring assignments and telemetry status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xs text-slate-600 hover:text-slate-800"
          >
            ← Monitoring Station
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Cancel' : 'Link New Patient'}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Patient Form */}
      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Link New Patient Assignment
          </h2>
          <p className="text-xs text-slate-600 mb-3">
            The patient must enter your caretaker account email in their Account Settings before you can link them.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Patient FallGuard Account Email *
                </label>
                <input
                  type="email"
                  placeholder="patient@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Device Pairing Code (e.g. FG-5520-B) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. FG-5520-B"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 font-mono uppercase focus:outline-none focus:border-teal-700"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setError(null); }}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded hover:bg-slate-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Linking…' : 'Confirm & Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster Table */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Active Patient Roster
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {patients.length} Registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-medium">Patient</th>
                <th className="py-2.5 px-4 font-medium">Residence</th>
                <th className="py-2.5 px-4 font-medium">Hardware Unit</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Last Seen</th>
                <th className="py-2.5 px-4 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => {
                const statusCfg = getDeviceStatusConfig(patient.deviceStatus);
                const isFall = patient.currentStatus === 'fall_detected';

                return (
                  <tr key={patient.id} className={isFall ? 'bg-rose-50/50' : 'hover:bg-slate-50/60'}>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{patient.name}</div>
                      <div className="text-[11px] text-slate-500">{patient.email}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {patient.room || 'General'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">
                      {patient.deviceId}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                      >
                        {patient.deviceStatus === 'online' && <Wifi className="w-3 h-3 text-emerald-700" />}
                        {patient.deviceStatus === 'offline' && <WifiOff className="w-3 h-3 text-slate-500" />}
                        {patient.deviceStatus === 'unknown' && <HelpCircle className="w-3 h-3 text-slate-500" />}
                        <span>{statusCfg.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                      <div>{patient.lastSeen ? formatTimeAgo(patient.lastSeen) : 'No telemetry yet'}</div>
                      {patient.lastSeen && <div className="text-[10px] text-slate-400">{formatTimestamp(patient.lastSeen)}</div>}
                    </td>
                    <td className="py-2.5 px-4">
                      {isFall ? (
                        <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-[11px] font-semibold">
                          <AlertTriangle className="w-3 h-3 text-rose-700" />
                          <span>Fall Alert</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium">
                          <ShieldCheck className="w-3 h-3 text-emerald-700" />
                          <span>Nominal</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
