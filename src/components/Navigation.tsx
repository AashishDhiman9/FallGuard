import React, { useState } from 'react';
import {
  LayoutDashboard,
  Cpu,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavigationProps {
  user: UserProfile;
  currentView: string;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
  onSwitchRole: (role: 'user' | 'caretaker') => void;
  activeAlertCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  user,
  currentView,
  onNavigate,
  onSignOut,
  onSwitchRole,
  activeAlertCount = 0,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isUser = user.role === 'user';

  const navItems = isUser
    ? [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'device', label: 'Device Settings', icon: Cpu },
        { id: 'settings', label: 'Account & Alerts', icon: Settings },
      ]
    : [
        { id: 'dashboard', label: 'Monitoring Center', icon: LayoutDashboard },
        { id: 'patients', label: 'Linked Patients', icon: Users },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-teal-700 flex items-center justify-center text-white text-xs font-bold tracking-tight">
            FG
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-900 tracking-tight">FallGuard</span>
            <span className="text-xs text-slate-500 ml-2">
              {isUser ? 'Patient View' : 'Caretaker Portal'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeAlertCount > 0 && !isUser && (
            <span className="flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{activeAlertCount}</span>
            </span>
          )}
          <button
            type="button"
            aria-label="Toggle Navigation Menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-700 hover:text-slate-900 border border-slate-200 rounded"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-2 sticky top-[53px] z-20 shadow-sm">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded text-left transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="px-1 text-xs text-slate-500">
              Logged in as <strong className="text-slate-800">{user.name}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSwitchRole(isUser ? 'caretaker' : 'user');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 text-xs text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 py-1.5 px-2 rounded font-medium text-center"
              >
                Switch to {isUser ? 'Caretaker' : 'Patient'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-slate-600 hover:text-rose-700 border border-slate-200 py-1.5 px-3 rounded"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Fixed Narrow Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen">
        {/* App Title & Role */}
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-teal-700 flex items-center justify-center text-white text-xs font-bold tracking-tight">
              FG
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-tight">
                FallGuard
              </h1>
              <p className="text-[11px] text-slate-500">Healthcare Telemetry</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              {isUser ? 'Patient Account' : 'Caretaker Portal'}
            </span>
            <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
              {user.role}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="px-3 py-4 flex-1">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider px-3 mb-2">
            Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded text-left transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-900 border border-teal-200 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.id === 'dashboard' && activeAlertCount > 0 && !isUser && (
                    <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded">
                      {activeAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active Profile */}
          <div className="mt-8 pt-4 border-t border-slate-200">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Active Account</span>
              {user.isDemo && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                  Demo
                </span>
              )}
            </div>
            <div className="px-3 py-2 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700 mb-2">
              <div className="font-semibold text-slate-900 truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>

            {user.isDemo ? (
              <button
                type="button"
                onClick={() => onSwitchRole(isUser ? 'caretaker' : 'user')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-teal-900 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Switch to {isUser ? 'Dr. Chen (Caretaker)' : 'Eleanor (Patient)'}</span>
              </button>
            ) : (
              <div className="text-[11px] text-slate-500 px-1 italic">
                Role is immutable in compliance with healthcare security rules.
              </div>
            )}
          </div>
        </div>

        {/* Footer info & Sign Out */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <div className="text-[11px] text-slate-500 px-2 mb-2 leading-relaxed">
            {user.isDemo ? 'Demo Mode · Simulated Telemetry' : 'Firebase Auth · Realtime DB'}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-white rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
