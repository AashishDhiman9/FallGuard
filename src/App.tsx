import React, { useState, useEffect } from 'react';
import {
  DEMO_CARETAKER,
  DEMO_PATIENT,
  INITIAL_DEVICE_INFO,
  INITIAL_FALL_EVENTS,
  INITIAL_LINKED_PATIENTS,
} from './mockData';
import { DeviceInfo, FallEvent, LinkedPatient, UserProfile, UserRole } from './types';
import { acknowledgeAlert, getActiveAlerts } from './utils/monitoring';
import { Navigation } from './components/Navigation';
import { UserDashboard } from './components/UserDashboard';
import { CaretakerDashboard } from './components/CaretakerDashboard';
import { DeviceLinkingScreen } from './components/DeviceLinkingScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { PatientsScreen } from './components/PatientsScreen';
import { AuthScreen } from './components/AuthScreen';
import { isFirebaseConfigured } from './firebase/config';
import { logoutFromFirebase, subscribeToAuthState } from './firebase/auth';
import { linkPatientToCaretaker } from './firebase/caretaker';
import {
  acknowledgeFallAlertInDB,
  linkDeviceToPatientInDB,
  subscribeToDevice,
  subscribeToFallEvents,
  subscribeToLinkedPatients,
  updateUserSettingsInDB,
} from './firebase/database';
import { AlertCircle, RefreshCw, Database } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Operational states
  const [device, setDevice] = useState<DeviceInfo>({
    id: 'Unassigned',
    serialNumber: 'Not paired',
    macAddress: 'No device paired',
    firmwareVersion: 'Awaiting sync',
    status: 'not_connected',
    lastSync: new Date().toISOString(),
  });
  const [events, setEvents] = useState<FallEvent[]>([]);
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 1. Subscribe to Firebase Auth state on mount
  useEffect(() => {
    if (isFirebaseConfigured) {
      let authStateResolved = false;
      const authTimeout = window.setTimeout(() => {
        if (authStateResolved) return;

        setAuthNotice(
          'Firebase could not verify the session in time. You can still sign in or use a demo profile. Check the Firebase web configuration and authorized domains if this continues.'
        );
        setIsAuthLoading(false);
      }, 15_000);

      const unsubscribe = subscribeToAuthState((user, loading, notice) => {
        setIsAuthLoading(loading);
        if (!loading) {
          authStateResolved = true;
          window.clearTimeout(authTimeout);
          setAuthNotice(notice ?? null);
        }
        if (user) {
          setCurrentUser(user);
        } else {
          // If no Firebase session active, leave null so AuthScreen is shown
          setCurrentUser(null);
        }
      });
      return () => {
        window.clearTimeout(authTimeout);
        unsubscribe();
      };
    } else {
      // Without Firebase, only the explicitly selected demo profiles are available.
      setIsAuthLoading(false);
      setAuthNotice('Firebase is not configured. Sign in and registration require Firebase; use a demo profile to explore the app.');
      setCurrentUser(null);
    }
  }, []);

  // Keep account-scoped data from a previous session out of the next account's view.
  useEffect(() => {
    if (!currentUser) {
      setDevice({
        id: 'Unassigned',
        serialNumber: 'Not paired',
        macAddress: 'No device paired',
        firmwareVersion: 'Awaiting sync',
        status: 'not_connected',
        lastSync: new Date().toISOString(),
      });
      setEvents([]);
      setPatients([]);
      return;
    }

    if (currentUser.isDemo) {
      setDevice(INITIAL_DEVICE_INFO);
      setEvents(INITIAL_FALL_EVENTS);
      setPatients(INITIAL_LINKED_PATIENTS);
      return;
    }

    setDevice({
      id: currentUser.deviceId || 'Unassigned',
      serialNumber: currentUser.deviceId || 'Not paired',
      macAddress: currentUser.deviceId ? 'Waiting for device data' : 'No device paired',
      firmwareVersion: 'Awaiting sync',
      status: 'not_connected',
      lastSync: new Date().toISOString(),
    });
    setEvents([]);
    setPatients([]);
  }, [currentUser?.id, currentUser?.isDemo, currentUser?.role, currentUser?.deviceId]);

  // 2. Realtime Database subscriptions when a real (non-demo) user is authenticated
  useEffect(() => {
    if (!currentUser || currentUser.isDemo || !isFirebaseConfigured) return;

    // A. If Patient: subscribe to device telemetry & fall events
    if (currentUser.role === 'user') {
      const unsubDev = subscribeToDevice(currentUser.deviceId, (liveDevice) => {
        setDevice(liveDevice || {
          id: currentUser.deviceId || 'Unassigned',
          serialNumber: currentUser.deviceId || 'Not paired',
          macAddress: currentUser.deviceId ? 'Waiting for device data' : 'No device paired',
          firmwareVersion: 'Awaiting sync',
          status: 'not_connected',
          lastSync: new Date().toISOString(),
        });
      });

      const unsubEvents = subscribeToFallEvents(currentUser, (liveEvents) => {
        setEvents(liveEvents);
      });

      return () => {
        unsubDev();
        unsubEvents();
      };
    }

    // B. If Caretaker: subscribe to assigned patients roster & active events
    if (currentUser.role === 'caretaker') {
      const unsubPatients = subscribeToLinkedPatients(currentUser.id, (livePatients) => {
        setPatients(livePatients);
      });

      const unsubEvents = subscribeToFallEvents(currentUser, (liveEvents) => {
        setEvents(liveEvents);
      });

      return () => {
        unsubPatients();
        unsubEvents();
      };
    }
  }, [currentUser]);

  // Active alerts count across all patients
  const activeAlerts = getActiveAlerts(events);
  const activeAlertCount = activeAlerts.length;

  // Handle acknowledge action from Caretaker Dashboard
  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!currentUser) return;

    if (currentUser.isDemo || !isFirebaseConfigured) {
      // Mock acknowledge in demo mode
      const updatedEvents = acknowledgeAlert(events, alertId, currentUser.name);
      setEvents(updatedEvents);

      const acknowledgedEvent = events.find((e) => e.id === alertId);
      if (acknowledgedEvent) {
        setPatients((prev) =>
          prev.map((patient) => {
            if (patient.id === acknowledgedEvent.userId) {
              return {
                ...patient,
                currentStatus: 'normal',
                activeAlertCount: Math.max(0, patient.activeAlertCount - 1),
              };
            }
            return patient;
          })
        );
      }
    } else {
      // Real Firebase Realtime Database update
      try {
        await acknowledgeFallAlertInDB({
          alertId,
          caretakerUid: currentUser.id,
          caretakerName: currentUser.name,
        });
      } catch (err) {
        console.error('Failed to acknowledge alert in database:', err);
      }
    }
  };

  const handleSwitchRole = (newRole: UserRole) => {
    if (newRole === 'user') {
      setCurrentUser({ ...DEMO_PATIENT, isDemo: true });
    } else {
      setCurrentUser({ ...DEMO_CARETAKER, isDemo: true });
    }
    setCurrentView('dashboard');
  };

  const handleUpdateDevice = async (updated: Partial<DeviceInfo>) => {
    if (currentUser && !currentUser.isDemo && isFirebaseConfigured) {
      if (updated.serialNumber) {
        await linkDeviceToPatientInDB(currentUser.id, updated.serialNumber);
      }
    }
    setDevice((prev) => ({ ...prev, ...updated }));
  };

  const handleUpdateUser = async (updated: Partial<UserProfile>) => {
    if (!currentUser) throw new Error('Sign in again before updating account settings.');
    if (!currentUser.isDemo && isFirebaseConfigured) {
      await updateUserSettingsInDB(currentUser.id, updated);
    }
    setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null));
  };

  const handleAddPatient = async (patient: { email: string; deviceId: string }): Promise<LinkedPatient> => {
    if (!currentUser || currentUser.isDemo || !isFirebaseConfigured) {
      throw new Error('Patient linking requires a signed-in Firebase caretaker account.');
    }

    const linkedPatient = await linkPatientToCaretaker(patient.email, patient.deviceId);
    setPatients((prev) => [linkedPatient, ...prev.filter((existing) => existing.id !== linkedPatient.id)]);
    return linkedPatient;
  };

  const handleSignOut = async () => {
    if (!currentUser?.isDemo && isFirebaseConfigured) {
      await logoutFromFirebase();
    }
    setAuthNotice(null);
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setDevice((prev) => ({
        ...prev,
        lastSync: new Date().toISOString(),
      }));
    }, 450);
  };

  // Initial authentication loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-white border border-slate-200 px-4 py-3 rounded shadow-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
          <span>Verifying FallGuard session and security credentials...</span>
        </div>
      </div>
    );
  }

  // Protected route: show login/register if not authenticated
  if (!currentUser) {
    return (
      <AuthScreen
        authNotice={authNotice}
        onLogin={(user) => {
          setAuthNotice(null);
          setCurrentUser(user);
          setCurrentView('dashboard');
        }}
      />
    );
  }

  const isUser = currentUser.role === 'user';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col md:flex-row antialiased">
      {/* Navigation (Sidebar on Desktop, Top Bar on Mobile) */}
      <Navigation
        user={currentUser}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onSignOut={handleSignOut}
        onSwitchRole={handleSwitchRole}
        activeAlertCount={activeAlertCount}
      />

      {/* Main Viewport Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {authNotice && (
          <div className="mx-4 mt-4 md:mx-8 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center gap-2" role="status">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{authNotice}</span>
          </div>
        )}

        {/* Top Operational Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-medium text-slate-700">Healthcare Monitor</span>
            <span className="text-slate-300">/</span>
            <span className="capitalize text-slate-600">
              {currentView === 'dashboard'
                ? isUser
                  ? 'Patient Overview'
                  : 'Monitoring Station'
                : currentView === 'device'
                ? 'Device Configuration'
                : currentView === 'patients'
                ? 'Patient Roster'
                : 'Account Settings'}
            </span>
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            {currentUser.isDemo ? (
              <>
                <span className="font-medium text-amber-700">Demo Telemetry Mode</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">Mock ESP32 records</span>
              </>
            ) : (
              <>
                <span className="font-medium text-emerald-700">Firebase Realtime DB</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Live Auth & Telemetry</span>
              </>
            )}
          </div>
        </div>

        {/* Viewport Dynamic Content */}
        <div className="p-4 md:p-8 flex-1">
          {isUser ? (
            /* USER DASHBOARD & SCREENS */
            <>
              {currentView === 'dashboard' && (
                <UserDashboard
                  user={currentUser}
                  device={device}
                  events={events}
                  onNavigateToDeviceSettings={() => setCurrentView('device')}
                  onRefresh={handleRefresh}
                  isLoading={isLoading}
                />
              )}
              {currentView === 'device' && (
                <DeviceLinkingScreen
                  user={currentUser}
                  device={device}
                  onUpdateDevice={handleUpdateDevice}
                  onBackToDashboard={() => setCurrentView('dashboard')}
                />
              )}
              {currentView === 'settings' && (
                <SettingsScreen
                  user={currentUser}
                  onUpdateUser={handleUpdateUser}
                  onBackToDashboard={() => setCurrentView('dashboard')}
                />
              )}
            </>
          ) : (
            /* CARETAKER DASHBOARD & SCREENS */
            <>
              {currentView === 'dashboard' && (
                <CaretakerDashboard
                  linkedPatients={patients}
                  events={events}
                  onAcknowledgeAlert={handleAcknowledgeAlert}
                  onRefresh={handleRefresh}
                  isLoading={isLoading}
                />
              )}
              {currentView === 'patients' && (
                <PatientsScreen
                  patients={patients}
                  onAddPatient={handleAddPatient}
                  onBackToDashboard={() => setCurrentView('dashboard')}
                />
              )}
              {currentView === 'settings' && (
                <SettingsScreen
                  user={currentUser}
                  onUpdateUser={handleUpdateUser}
                  onBackToDashboard={() => setCurrentView('dashboard')}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
