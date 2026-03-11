
import { useState, lazy, Suspense } from 'preact/compat';
import { Router, Route, Switch, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import { db } from './services/db';
import { User } from './types';

const Templates = lazy(() => import('./pages/Templates'));
const TemplateEditor = lazy(() => import('./pages/TemplateEditor'));
const WorkoutSession = lazy(() => import('./pages/WorkoutSession'));
const History = lazy(() => import('./pages/History'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail'));

const App = () => {
  const [user, setUser] = useState<User | null>(db.getCurrentUser());

  const handleLogin = (u: User) => {
    db.setCurrentUser(u);
    setUser(u);
  };

  const handleLogout = () => {
    db.setCurrentUser(null);
    setUser(null);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <Router hook={useHashLocation}>
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
