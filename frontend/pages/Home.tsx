
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Plus, Play, ClipboardList, ChevronRight, History as HistoryIcon, Clock, Calendar } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutInstance, User } from '../types';

const Home: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutInstance[]>([]);
  const [draft, setDraft] = useState<WorkoutInstance | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [instances, existingDraft] = await Promise.all([
        db.getInstances(user.id),
        db.getDraft(),
      ]);
      setRecentWorkouts(instances.slice(0, 3));
      setDraft(existingDraft);
    };
    loadData();
  }, [user.id]);

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(ts);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.username}</h1>
        <p className="text-zinc-400">Ready to crush your session?</p>
      </header>

      {/* Resume Draft Banner */}
      {draft && (
        <button
          onClick={() => navigate(`/workout/new?draftId=${draft!.id}`)}
          className="w-full p-6 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-between group hover:bg-amber-500/20 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="bg-amber-500/20 p-3 rounded-2xl">
              <Play className="text-amber-400" size={24} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-amber-400">Resume Workout</h3>
              <p className="text-zinc-400 text-sm">{draft.name} &middot; {draft.exercises.length} exercise{draft.exercises.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <ChevronRight className="text-amber-400 group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* Primary Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/workout/new')}
          className="relative overflow-hidden group p-8 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-600/20 flex flex-col items-start gap-4 transition-all hover:bg-indigo-500 active:scale-[0.98]"
        >
          <div className="bg-white/20 p-3 rounded-2xl">
            <Play className="fill-white" size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold">Start Empty Workout</h3>
            <p className="text-white/70 text-sm">Add exercises as you go</p>
          </div>
          <Plus className="absolute top-6 right-6 opacity-20 group-hover:scale-125 transition-transform" size={48} />
        </button>

        <button
          onClick={() => navigate('/templates')}
          className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col items-start gap-4 transition-all hover:border-zinc-700 active:scale-[0.98]"
        >
          <div className="bg-zinc-800 p-3 rounded-2xl">
            <ClipboardList className="text-indigo-400" size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold">Use a Template</h3>
            <p className="text-zinc-400 text-sm">Pick from your pre-set routines</p>
          </div>
        </button>
      </div>

      {/* Recent History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HistoryIcon size={20} className="text-zinc-500" />
            Recent History
          </h2>
          <Link to="/history" className="text-indigo-400 text-sm font-semibold flex items-center gap-1 hover:underline">
            View All <ChevronRight size={16} />
          </Link>
        </div>

        <div className="space-y-3">
          {recentWorkouts.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-500">No workouts recorded yet.</p>
            </div>
          ) : (
            recentWorkouts.map((workout) => (
              <button
                key={workout.id}
                onClick={() => navigate(`/history/${workout.id}`)}
                className="w-full flex items-center justify-between p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-indigo-600/10 group-hover:text-indigo-400 transition-colors">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold">{workout.name || 'Untitled Workout'}</h4>
                    <div className="flex items-center gap-3 text-sm text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {formatDate(workout.date)}
                      </span>
                      <span>•</span>
                      <span>{workout.exercises.length} exercises</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-zinc-600" />
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
