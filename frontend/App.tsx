
import { useState, useEffect, lazy, Suspense } from 'preact/compat';
import { Router, Route, Switch, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import { db } from './services/db';
import { initialSync, pullSync, flushOutbox } from './services/sync';
import { onAuthRequest } from './services/syncStore';
import { User } from './types';

const Templates = lazy(() => import('./pages/Templates'));
const TemplateEditor = lazy(() => import('./pages/TemplateEditor'));
const WorkoutSession = lazy(() => import('./pages/WorkoutSession'));
const History = lazy(() => import('./pages/History'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail'));

const App = () => {
  const [user, setUser] = useState<User | null>(db.getCurrentUser());
  const [isLoading, setIsLoading] = useState(() => {
    return !!db.getCurrentUser() && !localStorage.getItem('irontrack_last_sync');
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLogin = (u: User) => {
    db.setCurrentUser(u);
    if (!localStorage.getItem('irontrack_last_sync')) {
      setIsLoading(true);
    }
    setUser(u);
  };

  const handleLogout = () => {
    db.setCurrentUser(null);
    setUser(null);
  };

  // Register auth-request handler (shown by SyncIndicator when token expires)
  useEffect(() => onAuthRequest(() => setShowAuthModal(true)), []);

  useEffect(() => {
    if (!user) return;

    const hasSynced = !!localStorage.getItem('irontrack_last_sync');
    if (!hasSynced) {
      // First run — wait for initial pull before showing UI
      initialSync()
        .then(() => setIsLoading(false))
        .catch(() => setIsLoading(false));
    } else {
      // Returning user — pull delta in background
      setIsLoading(false);
      void initialSync();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void pullSync();
        void flushOutbox();
      }
    };
    const onOnline = () => { void flushOutbox(); };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [user]);

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (isLoading) {
    return (
      <div class="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div class="text-zinc-400 text-sm">Syncing…</div>
      </div>
    );
  }

  return (
    <Router hook={useHashLocation}>
      {showAuthModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onClick={() => setShowAuthModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Auth modal onLogin={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
      <Layout user={user} onLogout={handleLogout}>
        <Suspense fallback={null}>
          <Switch>
            <Route path="/">{() => <Redirect to="/templates" />}</Route>
            <Route path="/templates">{() => <Templates user={user} />}</Route>
            <Route path="/templates/new">{() => <TemplateEditor user={user} />}</Route>
            <Route path="/templates/edit/:id">{() => <TemplateEditor user={user} />}</Route>
            <Route path="/workout/new">{() => <WorkoutSession user={user} />}</Route>
            <Route path="/history">{() => <History user={user} />}</Route>
            <Route path="/history/:id">{() => <InstanceDetail user={user} />}</Route>
            <Redirect to="/" />
          </Switch>
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
