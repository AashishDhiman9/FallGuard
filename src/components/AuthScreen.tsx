import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Stethoscope, ArrowRight, AlertCircle, RefreshCw, Database } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { DEMO_PATIENT, DEMO_CARETAKER } from '../mockData';
import { isFirebaseConfigured } from '../firebase/config';
import { registerWithFirebase, loginWithFirebase } from '../firebase/auth';

interface AuthScreenProps {
  onLogin: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide your email address and password.');
      return;
    }

    if (tab === 'register' && !name.trim()) {
      setError('Please provide your full legal or preferred display name.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isFirebaseConfigured) {
        if (tab === 'register') {
          const registered = await registerWithFirebase({
            email,
            password,
            displayName: name.trim(),
            role,
            deviceId: role === 'user' ? deviceId : undefined,
          });
          onLogin(registered);
        } else {
          // Login with Firebase
          await loginWithFirebase(email, password);
          // onAuthStateChanged in App will automatically sync the profile from RTDB
        }
      } else {
        // Fallback for demo when Firebase config variables have not yet been provided in .env
        const mockUser: UserProfile = {
          id: `demo-${Date.now()}`,
          name: tab === 'register' ? name.trim() : (role === 'user' ? 'Eleanor Vance' : 'Dr. Marcus Chen, RN'),
          email: email.trim(),
          role: role,
          createdAt: Date.now(),
          deviceId: role === 'user' ? (deviceId.trim().toUpperCase() || 'FG-8821-X') : undefined,
          caretakerName: role === 'user' ? 'Dr. Marcus Chen, RN' : undefined,
          caretakerEmail: role === 'user' ? 'marcus.chen@carenetwork.org' : undefined,
          isDemo: true,
          notifications: {
            sms: true,
            email: true,
            push: true,
          },
        };
        onLogin(mockUser);
      }
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      console.error('Authentication error:', fbErr);

      if (fbErr.code === 'auth/invalid-credential' || fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/user-not-found') {
        setError('Invalid email or password. Please verify your credentials or register a new account.');
      } else if (fbErr.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (fbErr.code === 'auth/weak-password') {
        setError('Password is too short. Please choose a password with at least 6 characters.');
      } else if (fbErr.code === 'auth/invalid-email') {
        setError('The email address format is invalid.');
      } else {
        setError(fbErr.message || 'An authentication error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = (demoUser: UserProfile) => {
    onLogin({ ...demoUser, isDemo: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Lockup */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded bg-teal-700 flex items-center justify-center text-white text-sm font-bold tracking-tight">
            FG
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            FallGuard
          </span>
        </div>
        <h2 className="text-center text-xs text-slate-600 font-medium">
          Healthcare Telemetry & Fall Detection Portal
        </h2>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        {/* Firebase status header */}
        <div className="mb-3 px-3 py-2 bg-white border border-slate-200 rounded text-[11px] text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>Backend:</span>
            {isFirebaseConfigured ? (
              <span className="font-semibold text-emerald-700">Firebase Auth & Realtime DB Active</span>
            ) : (
              <span className="text-slate-500 font-medium">Local Demonstration (Setup .env for live Firebase)</span>
            )}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white py-6 px-6 border border-slate-200 rounded shadow-xs space-y-5">
          {/* Tabs: Sign In / Register */}
          <div className="grid grid-cols-2 border-b border-slate-200 pb-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`py-1.5 text-xs font-semibold text-center rounded transition-colors ${
                tab === 'login'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`py-1.5 text-xs font-semibold text-center rounded transition-colors ${
                tab === 'register'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Account
            </button>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Select Account Role:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`p-2.5 border rounded flex flex-col items-center gap-1 transition-colors text-left ${
                  role === 'user'
                    ? 'border-teal-700 bg-teal-50/60 text-slate-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck className={`w-4 h-4 ${role === 'user' ? 'text-teal-700' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">Patient</span>
                </div>
                <span className="text-[11px] text-slate-500 text-center">
                  Monitored user
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole('caretaker')}
                className={`p-2.5 border rounded flex flex-col items-center gap-1 transition-colors text-left ${
                  role === 'caretaker'
                    ? 'border-teal-700 bg-teal-50/60 text-slate-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Stethoscope className={`w-4 h-4 ${role === 'caretaker' ? 'text-teal-700' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">Caretaker</span>
                </div>
                <span className="text-[11px] text-slate-500 text-center">
                  Nurse / Caregiver
                </span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 italic">
              Note: System security rules enforce that account roles cannot be altered after creation.
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {tab === 'register' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Full Display Name *
                </label>
                <input
                  type="text"
                  placeholder={role === 'user' ? 'e.g. Eleanor Vance' : 'e.g. Dr. Marcus Chen, RN'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                placeholder={role === 'user' ? 'patient@example.org' : 'nurse@carenetwork.org'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-teal-700"
                required
                minLength={6}
              />
            </div>

            {tab === 'register' && role === 'user' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Hardware Pairing Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. FG-8821-X"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 font-mono uppercase focus:outline-none focus:border-teal-700"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Format: FG-XXXX-X (Can also be paired later in Device Settings)
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded transition-colors shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{tab === 'login' ? 'Sign In to Portal' : 'Register with FallGuard'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-3 border-t border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 text-center">
              Quick Prototype Logins (Demo Profiles)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo(DEMO_PATIENT)}
                className="p-2 border border-slate-200 hover:border-teal-700 bg-slate-50 hover:bg-teal-50/50 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-900 truncate">
                  Patient Eleanor
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Device: FG-8821-X (Demo)
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo(DEMO_CARETAKER)}
                className="p-2 border border-slate-200 hover:border-teal-700 bg-slate-50 hover:bg-teal-50/50 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-900 truncate">
                  Caretaker Dr. Chen
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  4 Linked Patients (Demo)
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Discrete mock data disclosure */}
        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Patient data privacy enforced by Firebase Authentication & Realtime Database rules.</span>
        </div>
      </div>
    </div>
  );
};
