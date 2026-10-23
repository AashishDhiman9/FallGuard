import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Wifi,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { DeviceInfo, UserProfile } from '../types';
import { validatePairingCode, formatTimestamp, getDeviceStatusConfig } from '../utils/monitoring';

interface DeviceLinkingScreenProps {
  user: UserProfile;
  device: DeviceInfo;
  onUpdateDevice: (updated: Partial<DeviceInfo>) => void;
  onBackToDashboard: () => void;
}

export const DeviceLinkingScreen: React.FC<DeviceLinkingScreenProps> = ({
  user,
  device,
  onUpdateDevice,
  onBackToDashboard,
}) => {
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const statusConfig = getDeviceStatusConfig(device.status);

  const handlePairDevice = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const code = pairingCodeInput.trim().toUpperCase();

    if (!code) {
      setErrorMessage('Please enter a FallGuard device pairing code.');
      return;
    }

    if (!validatePairingCode(code)) {
      setErrorMessage(
        'Invalid code format. Expected format is FG-XXXX-X (e.g., FG-8821-X or FG-4102-Y).'
      );
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      onUpdateDevice({
        serialNumber: code,
        status: 'online',
        lastSync: new Date().toISOString(),
      });
      setSuccessMessage(`Device ${code} successfully paired and telemetry verified.`);
      setPairingCodeInput('');
    }, 600);
  };

  const handleUnpair = () => {
    if (window.confirm('Are you sure you want to unpair this monitoring device?')) {
      onUpdateDevice({
        status: 'offline',
      });
      setSuccessMessage('Device unpaired from current monitoring profile.');
    }
  };

  const handleStatusToggle = (newStatus: 'online' | 'offline' | 'unknown') => {
    onUpdateDevice({
      status: newStatus,
      lastSync: new Date().toISOString(),
    });
    setSuccessMessage(`Simulated device status set to: ${newStatus.toUpperCase()}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Device Configuration & Linking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hardware identifier, telemetry channel, and pairing management
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="text-xs text-teal-700 hover:text-teal-800 font-medium underline underline-offset-2"
        >
          ← Return to Dashboard
        </button>
      </div>

      {/* Honest notice regarding mock hardware */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-800">Hardware Simulation Notice:</strong> This portal uses clearly labelled mock telemetry data. No physical ESP32 microcontroller or pendant hardware is currently transmitting live packets.
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Current Device Details */}
      <div className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Active Hardware Unit
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
          >
            <Wifi className="w-3 h-3" />
            <span>{statusConfig.label}</span>
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Device Serial / Pairing ID</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
              {device.serialNumber}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">MAC Address (Simulated)</span>
            <span className="font-mono tabular-nums text-slate-800">
              {device.macAddress}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">Firmware Build</span>
            <span className="font-mono tabular-nums text-slate-800">
              {device.firmwareVersion}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">Last Transmission</span>
            <span className="font-mono tabular-nums text-slate-800">
              {formatTimestamp(device.lastSync)}
            </span>
          </div>
        </div>

        {/* Status simulator for demonstration inspection */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600">Simulate hardware connection state:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStatusToggle('online')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                device.status === 'online'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Online
            </button>
            <button
              type="button"
              onClick={() => handleStatusToggle('offline')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                device.status === 'offline'
                  ? 'bg-slate-300 text-slate-900 border-slate-400 font-semibold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Offline
            </button>
            <button
              type="button"
              onClick={() => handleStatusToggle('unknown')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                device.status === 'unknown'
                  ? 'bg-slate-200 text-slate-800 border-slate-300 font-semibold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Unknown
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={handleUnpair}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-700 hover:text-rose-800 border border-rose-200 hover:bg-rose-50 rounded transition-colors"
          >
            <Unlink className="w-3.5 h-3.5" />
            <span>Unpair Device</span>
          </button>
        </div>
      </div>

      {/* Pair New Device Form */}
      <div className="bg-white border border-slate-200 rounded p-4">
        <div className="flex items-center gap-2 mb-2">
          <LinkIcon className="w-4 h-4 text-teal-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Link Replacement or New Device
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Enter the 8-character pairing code printed on the rear label of your FallGuard pendant or base unit.
        </p>

        <form onSubmit={handlePairDevice} className="space-y-3">
          <div>
            <label
              htmlFor="pairingCode"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Device Pairing Code
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="pairingCode"
                type="text"
                placeholder="e.g. FG-8821-X"
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded transition-colors disabled:opacity-60"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Verify & Link</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Sample valid demo codes: <span className="font-mono">FG-8821-X</span>, <span className="font-mono">FG-4102-Y</span>, <span className="font-mono">FG-6799-Z</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
