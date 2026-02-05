
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import WorkoutSession from './pages/WorkoutSession';
import History from './pages/History';
import InstanceDetail from './pages/InstanceDetail';
import { db } from './services/db';
import { User } from './types';

const App: React.FC = () => {
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
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/templates" element={<Templates user={user} />} />
          <Route path="/templates/new" element={<TemplateEditor user={user} />} />
          <Route path="/templates/edit/:id" element={<TemplateEditor user={user} />} />
          <Route path="/workout/new" element={<WorkoutSession user={user} />} />
          <Route path="/history" element={<History user={user} />} />
          <Route path="/history/:id" element={<InstanceDetail user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
