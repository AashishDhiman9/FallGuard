import React, { useState } from 'react';
import {
  Bell,
  Sliders,
  Phone,
  User,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { UserProfile } from '../types';

interface SettingsScreenProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onBackToDashboard: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  onUpdateUser,
  onBackToDashboard,
}) => {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    emergencyContact: user.emergencyContact || '',
    caretakerName: user.caretakerName || '',
    caretakerEmail: user.caretakerEmail || '',
    sensitivity: user.sensitivity || 'standard',
    smsNotifications: user.notifications?.sms ?? true,
    emailNotifications: user.notifications?.email ?? true,
    pushNotifications: user.notifications?.push ?? true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      emergencyContact: formData.emergencyContact,
      caretakerName: formData.caretakerName,
      caretakerEmail: formData.caretakerEmail,
      sensitivity: formData.sensitivity as 'standard' | 'high' | 'assisted_living',
      notifications: {
        sms: formData.smsNotifications,
        email: formData.emailNotifications,
        push: formData.pushNotifications,
      },
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const isUser = user.role === 'user';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Settings & Notification Preferences
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure contact details, telemetry alerts, and response pathways
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

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Settings successfully updated and saved.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Profile */}
        <div className="bg-white border border-slate-200 rounded">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Account Identification
            </h2>
          </div>
          <div className="p-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Primary Telephone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              {isUser && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Emergency Contact (Name & Phone)
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContact: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fall Detection Sensitivity (For Patient view) */}
        {isUser && (
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Fall Detection Sensitivity
              </h2>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  className={`p-3 border rounded cursor-pointer transition-colors ${
                    formData.sensitivity === 'standard'
                      ? 'border-teal-700 bg-teal-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="sensitivity"
                      value="standard"
                      checked={formData.sensitivity === 'standard'}
                      onChange={() => setFormData({ ...formData, sensitivity: 'standard' })}
                      className="text-teal-700 focus:ring-teal-700"
                    />
                    <span className="font-semibold text-slate-900">Standard</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Balanced threshold for typical household activity. Filters out minor stumbling.
                  </p>
                </label>

                <label
                  className={`p-3 border rounded cursor-pointer transition-colors ${
                    formData.sensitivity === 'high'
                      ? 'border-teal-700 bg-teal-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="sensitivity"
                      value="high"
                      checked={formData.sensitivity === 'high'}
                      onChange={() => setFormData({ ...formData, sensitivity: 'high' })}
                      className="text-teal-700 focus:ring-teal-700"
                    />
                    <span className="font-semibold text-slate-900">High Sensitivity</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Detects soft or slow falls. Recommended for post-operative recovery.
                  </p>
                </label>

                <label
                  className={`p-3 border rounded cursor-pointer transition-colors ${
                    formData.sensitivity === 'assisted_living'
                      ? 'border-teal-700 bg-teal-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="sensitivity"
                      value="assisted_living"
                      checked={formData.sensitivity === 'assisted_living'}
                      onChange={() =>
                        setFormData({ ...formData, sensitivity: 'assisted_living' })
                      }
                      className="text-teal-700 focus:ring-teal-700"
                    />
                    <span className="font-semibold text-slate-900">Assisted Living</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Continuous monitoring with immediate alert escalation to on-duty nurse.
                  </p>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Caretaker Assignment (For Patient view) */}
        {isUser && (
          <div className="bg-white border border-slate-200 rounded">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Assigned Primary Caretaker
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Caretaker Name
                </label>
                <input
                  type="text"
                  value={formData.caretakerName}
                  onChange={(e) =>
                    setFormData({ ...formData, caretakerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Caretaker Contact Email
                </label>
                <input
                  type="email"
                  value={formData.caretakerEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, caretakerEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notification Channels */}
        <div className="bg-white border border-slate-200 rounded">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Incident Alert Channels
            </h2>
          </div>
          <div className="p-4 space-y-3 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.smsNotifications}
                onChange={(e) =>
                  setFormData({ ...formData, smsNotifications: e.target.checked })
                }
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <span className="font-medium text-slate-900">Urgent SMS Alerts</span>
                <span className="text-slate-500 block text-[11px]">
                  Send immediate text message to primary phone when fall acceleration exceeds threshold.
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.emailNotifications}
                onChange={(e) =>
                  setFormData({ ...formData, emailNotifications: e.target.checked })
                }
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <span className="font-medium text-slate-900">Email Incident Dispatch</span>
                <span className="text-slate-500 block text-[11px]">
                  Forward full event log with sensor timestamps and acknowledgment logs.
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.pushNotifications}
                onChange={(e) =>
                  setFormData({ ...formData, pushNotifications: e.target.checked })
                }
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <span className="font-medium text-slate-900">Browser & Mobile Notification</span>
                <span className="text-slate-500 block text-[11px]">
                  Display immediate desktop audio tone and browser banner upon alert.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
