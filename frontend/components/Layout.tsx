
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import SyncIndicator from './SyncIndicator';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { getSyncState, subscribeSyncState, applyUpdate } from '../services/syncStore';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [location] = useLocation();
  const { canInstall, triggerInstall } = useInstallPrompt();
  const [hasUpdate, setHasUpdate] = useState(() => getSyncState().status === 'update-available');

  useEffect(() => subscribeSyncState(s => setHasUpdate(s.status === 'update-available')), []);

  const navItems = [
    { path: '/templates', label: 'Train', active: location.startsWith('/templates') || location === '/' },
    { path: '/history', label: 'Review', active: location.startsWith('/history') },
  ];

  if (!user) return <>{children}</>;

  const isWorkout = location.startsWith('/workout');

  return (
    <div className={`app-canvas flex flex-col ${isWorkout ? '' : 'pb-20 md:pb-0 md:pl-64'}`}>
      {/* Desktop Sidebar */}
      <aside className={`${isWorkout ? 'hidden' : 'hidden md:flex'} app-sidebar flex-col fixed left-0 top-0 bottom-0 w-64 border-r p-6`}>
        <Link to="/templates" className="app-brand mb-10">
          <div className="brand-mark">
            IT
          </div>
          <div>
            <strong>IronTrack</strong>
            <span>Plan workouts</span>
          </div>
        </Link>

        <nav className="app-nav flex-1">
          {navItems.map((item) => {
            return (
              <Link
                key={item.path}
                to={item.path}
                className={item.active ? 'active' : ''}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <SyncIndicator />
          {canInstall && (
            <button
              onClick={triggerInstall}
              className="app-nav-button"
            >
              Install
            </button>
          )}
          <button
            onClick={onLogout}
            className="app-nav-button danger"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      {/* Update banner — sits just above the mobile bottom nav */}
      {hasUpdate && (
        <button
          onClick={applyUpdate}
          className="md:hidden fixed bottom-16 inset-x-0 mx-3 z-40 resume-banner flex items-center justify-between rounded-2xl px-5 py-3 active:scale-[0.98] transition-all"
        >
          <span className="text-sm font-bold">Update available</span>
          <span className="text-xs font-semibold opacity-75">Tap to reload →</span>
        </button>
      )}

      {/* Mobile Bottom Nav */}
      <nav className={`${isWorkout ? 'hidden' : ''} mobile-nav md:hidden fixed bottom-0 left-0 right-0 border-t flex justify-around items-center h-16 px-4 z-50`}>
        <button
          onClick={onLogout}
          className="mobile-nav-item danger"
        >
          <span className="flex items-center gap-1.5">
            Logout
            <SyncIndicator compact />
          </span>
        </button>
        {canInstall && (
          <button
            onClick={triggerInstall}
            className="mobile-nav-item"
          >
            Install
          </button>
        )}
        {navItems.map((item) => {
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${item.active ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
