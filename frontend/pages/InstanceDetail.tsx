
import React, { useEffect, useState, Fragment } from 'react';
import { useParams, useLocation } from 'wouter';
import { ChevronLeft, Calendar, Clock, Clipboard, FileText, Trash2, Link2 } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutInstance, User } from '../types';

const InstanceDetail: React.FC<{ user: User }> = ({ user }) => {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [instance, setInstance] = useState<WorkoutInstance | null>(null);

  useEffect(() => {
    const loadInstance = async () => {
      const all = await db.getInstances(user.id);
      const found = all.find(i => i.id === id);
      if (found) setInstance(found);
      else navigate('/history');
    };
    loadInstance();
  }, [id, user.id, navigate]);

  if (!instance) return null;

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(ts);
  };

  const deleteSelf = async () => {
    if (confirm('Delete this workout record?')) {
      await db.deleteInstance(instance.id);
      navigate('/history');
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/history')} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Workout Details</h1>
        </div>
        <button onClick={deleteSelf} className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors">
          <Trash2 size={20} />
        </button>
      </header>

      <section className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-600/20">
        <h2 className="text-3xl font-extrabold mb-4">{instance.name}</h2>
        <div className="flex flex-col gap-2 opacity-80 text-sm font-medium">
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            {formatDate(instance.date)}
          </div>
          <div className="flex items-center gap-2">
            <Clipboard size={16} />
            {instance.exercises.length} Exercises total
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-0">
        {instance.exercises.map((ex, exIdx) => {
          const isInSuperset = !!ex.supersetId;
          const isFirstInGroup = isInSuperset && (exIdx === 0 || instance.exercises[exIdx - 1].supersetId !== ex.supersetId);
          const linkedToPrev = isInSuperset && exIdx > 0 && instance.exercises[exIdx - 1].supersetId === ex.supersetId;
          return (
          <Fragment key={exIdx}>
          {exIdx > 0 && (
            <div className={`flex items-center gap-2 px-4 ${linkedToPrev ? 'my-0.5' : 'my-3'}`}>
              <div className={`flex-1 h-px ${linkedToPrev ? 'bg-indigo-500/30' : 'bg-zinc-800'}`} />
              {linkedToPrev && <Link2 size={10} className="text-indigo-400/60 shrink-0" />}
              <div className={`flex-1 h-px ${linkedToPrev ? 'bg-indigo-500/30' : 'bg-zinc-800'}`} />
            </div>
          )}
          <div className={`bg-zinc-900 rounded-3xl overflow-hidden ${
            isInSuperset ? 'border border-indigo-500/30 border-l-2 border-l-indigo-500' : 'border border-zinc-800'
          }`}>
            <div className="bg-zinc-800/50 p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                {isFirstInGroup && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                    Superset
                  </span>
                )}
                <h3 className="text-xl font-bold text-indigo-400">{ex.name}</h3>
              </div>
            </div>
            <div className="p-5">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
                    <th className="pb-2 w-12">Set</th>
                    <th className="pb-2">Weight</th>
                    <th className="pb-2">Reps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {ex.sets.map((set, setIdx) => (
                    <tr key={set.id}>
                      <td className="py-2 font-mono text-zinc-500">{setIdx + 1}</td>
                      <td className="py-2 font-bold text-lg">{set.weight} <span className="text-xs font-normal text-zinc-500">kg</span></td>
                      <td className="py-2 font-bold text-lg">{set.reps} <span className="text-xs font-normal text-zinc-500">reps</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </Fragment>
        );})}
      </div>

      {instance.notes && (
        <section className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem]">
          <div className="flex items-center gap-2 text-indigo-400 mb-4 font-bold uppercase tracking-widest text-xs">
            <FileText size={16} />
            Notes
          </div>
          <p className="text-zinc-300 leading-relaxed italic">
            "{instance.notes}"
          </p>
        </section>
      )}

      <button
        onClick={() => navigate(`/workout/new?templateId=${instance.templateId}`)}
        className="w-full py-5 bg-zinc-900 border border-zinc-800 rounded-3xl text-indigo-400 font-bold hover:bg-zinc-800 transition-all mb-10"
      >
        Repeat this Workout
      </button>
    </div>
  );
};

export default InstanceDetail;
