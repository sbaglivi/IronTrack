
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus, Save, Trash2, X, MoreVertical, Check, Search, Calendar, Clock } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutInstance, InstanceExercise, WorkoutSet, Exercise, User } from '../types';

const WorkoutSession: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<InstanceExercise[]>([]);
  const [notes, setNotes] = useState('');
  const [startTime] = useState(Date.now());
  const [timer, setTimer] = useState(0);

  // For adding new exercises to the instance
  const [showAddEx, setShowAddEx] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [exResults, setExResults] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setTimer(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const loadTemplate = async () => {
      if (templateId) {
        const templates = await db.getTemplates(user.id);
        const template = templates.find(t => t.id === templateId);
        if (template) {
          setName(template.name);
          setExercises(template.exercises.map(te => ({
            exerciseId: te.exerciseId,
            name: te.name,
            sets: Array.from({ length: te.defaultSets }, () => ({
              id: Math.random().toString(36).substr(2, 9),
              weight: te.defaultWeight,
              reps: te.defaultReps || 10,
              completed: false
            }))
          })));
        }
      } else {
        setName(`Workout ${new Intl.DateTimeFormat('en-US').format(new Date())}`);
      }
    };
    loadTemplate();
  }, [templateId, user.id]);

  useEffect(() => {
    const loadExercises = async () => {
      const all = await db.getExercises();
      setAllExercises(all);
      if (!exSearch.trim()) setExResults(all.slice(0, 5));
      else setExResults(all.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())));
    };
    loadExercises();
  }, [exSearch]);

  const addSet = (exIndex: number) => {
    const newExs = [...exercises];
    const lastSet = newExs[exIndex].sets[newExs[exIndex].sets.length - 1];
    newExs[exIndex].sets.push({
      id: Math.random().toString(36).substr(2, 9),
      weight: lastSet ? lastSet.weight : 0,
      reps: lastSet ? lastSet.reps : 10,
      completed: false
    });
    setExercises(newExs);
  };

  const updateSet = (exIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => {
    const newExs = [...exercises];
    newExs[exIndex].sets[setIndex] = { ...newExs[exIndex].sets[setIndex], ...updates };
    setExercises(newExs);
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    const newExs = [...exercises];
    newExs[exIndex].sets = newExs[exIndex].sets.filter((_, i) => i !== setIndex);
    setExercises(newExs);
  };

  const addExercise = async (ex: Exercise | string) => {
    let finalEx: Exercise;
    if (typeof ex === 'string') {
      const trimmedName = ex.trim();
      if (!trimmedName) return;
      const existing = allExercises.find(e => e.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        finalEx = existing;
      } else {
        finalEx = await db.addExercise(trimmedName);
        setAllExercises([...allExercises, finalEx]);
      }
    } else {
      finalEx = ex;
    }

    setExercises([...exercises, {
      exerciseId: finalEx.id,
      name: finalEx.name,
      sets: [{ id: Math.random().toString(36).substr(2, 9), weight: 0, reps: 10, completed: false }]
    }]);
    setShowAddEx(false);
    setExSearch('');
  };

  const removeExercise = (index: number) => {
    if (confirm('Remove this exercise from session?')) {
      setExercises(exercises.filter((_, i) => i !== index));
    }
  };

  const finishWorkout = async () => {
    if (exercises.length === 0) return alert('Add at least one exercise');
    const instance: WorkoutInstance = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      templateId: templateId || undefined,
      name: name || 'Untitled Workout',
      date: Date.now(),
      exercises,
      notes
    };
    await db.saveInstance(instance);
    navigate('/history');
  };

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 animate-in slide-in-from-right-4 duration-300">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-white">
            <X size={24} />
          </button>
          <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full font-mono font-bold text-sm">
            <Clock size={16} />
            {formatTimer(timer)}
          </div>
          <button onClick={finishWorkout} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
            Finish
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-3xl font-extrabold bg-transparent outline-none w-full border-b border-transparent focus:border-zinc-800 transition-colors text-white"
          placeholder="Workout Name"
        />
      </header>

      <div className="space-y-6">
        {exercises.map((ex, exIdx) => (
          <section key={exIdx} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-800/20">
              <h3 className="text-lg font-bold text-indigo-400">{ex.name}</h3>
              <button onClick={() => removeExercise(exIdx)} className="text-zinc-500 hover:text-red-400 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2">
                <div className="col-span-1 text-center">Set</div>
                <div className="col-span-5 text-center">Weight (kg)</div>
                <div className="col-span-5 text-center">Reps</div>
                <div className="col-span-1"></div>
              </div>

              {ex.sets.map((set, setIdx) => (
                <div key={set.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition-all bg-zinc-950/50">
                  <div className="col-span-1 text-center font-bold text-zinc-400">{setIdx + 1}</div>
                  <div className="col-span-5">
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => updateSet(exIdx, setIdx, { weight: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 text-center font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(exIdx, setIdx, { reps: parseInt(e.target.value) || 0 })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 text-center font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeSet(exIdx, setIdx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => addSet(exIdx)}
                className="w-full py-3 bg-zinc-800/50 border border-dashed border-zinc-700 rounded-xl text-zinc-400 font-bold text-sm hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                + Add Set
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setShowAddEx(true)}
          className="w-full py-5 border-2 border-dashed border-zinc-800 rounded-3xl flex items-center justify-center gap-2 text-zinc-500 font-bold hover:border-indigo-500 hover:text-indigo-400 transition-all"
        >
          <Plus size={20} />
          Add Exercise
        </button>

        <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none min-h-[100px]"
            placeholder="How did it feel today?"
          />
        </section>
      </div>

      {/* Add Exercise Modal */}
      {showAddEx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add Exercise</h3>
              <button onClick={() => setShowAddEx(false)} className="text-zinc-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  autoFocus
                  value={exSearch}
                  onChange={(e) => setExSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Search exercise..."
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {/* New Prominent "Create" option */}
                {exSearch.trim().length > 0 && !allExercises.some(e => e.name.toLowerCase() === exSearch.trim().toLowerCase()) && (
                  <button
                    onClick={() => addExercise(exSearch.trim())}
                    className="w-full text-left p-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-600/30 rounded-2xl text-indigo-400 font-bold transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <Plus size={18} className="group-hover:scale-110 transition-transform" />
                      <span>Create "{exSearch.trim()}"</span>
                    </div>
                  </button>
                )}

                {exResults.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    className="w-full text-left p-4 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-2xl font-bold transition-all flex items-center justify-between text-white"
                  >
                    <span>{ex.name}</span>
                    <Plus size={16} className="text-zinc-600" />
                  </button>
                ))}

                {exSearch.trim() === '' && (
                  <p className="p-10 text-center text-zinc-500 text-sm">Type an exercise name to search or create a new one.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutSession;
