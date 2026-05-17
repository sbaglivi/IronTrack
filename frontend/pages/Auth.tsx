
import React, { useState } from 'react';
import { db } from '../services/db';
import { Dumbbell, ArrowRight } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
  modal?: boolean;
}

const Auth: React.FC<AuthProps> = ({ onLogin, modal = false }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      let user;
      if (isLogin) {
        user = await db.login(username, password);
      } else {
        user = await db.signup(username, password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="w-full max-w-md">
      {!modal && (
        <div className="text-center mb-10">
          <h1 className="page-title text-4xl font-extrabold tracking-tight mb-2">IronTrack</h1>
          <p className="page-subtitle">Your journey starts with a single set.</p>
        </div>
      )}

      <div className="surface p-8 rounded-2xl">
        {modal && (
          <p className="page-subtitle text-sm mb-6">Your session expired. Sign in to resume sync - your local data is safe.</p>
        )}

        {!modal && (
          <div className="surface-muted flex rounded-xl p-1 mb-8">
            <button
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold uppercase tracking-widest transition-colors ${isLogin ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'page-subtitle'}`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold uppercase tracking-widest transition-colors ${!isLogin ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'page-subtitle'}`}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="field-label block text-xs font-bold uppercase tracking-widest mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-field w-full rounded-xl px-4 py-3 focus:outline-none transition-all"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="field-label block text-xs font-bold uppercase tracking-widest mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-field w-full rounded-xl px-4 py-3 focus:outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium animate-pulse">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 group transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );

  if (modal) return card;

  return (
    <div className="auth-backdrop min-h-screen flex items-center justify-center p-4">
      {card}
    </div>
  );
};

export default Auth;
