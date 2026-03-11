
import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChevronLeft, Plus, Search, Trash2, Save, X, Info, Link2 } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutTemplate, TemplateExercise, Exercise, User } from '../types';
import NumericInput from '../components/NumericInput';

const TemplateEditor: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const { id } = useParams();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);

  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseResults, setExerciseResults] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      if (isEditing) {
        const all = await db.getTemplates(user.id);
        const existing = all.find(t => t.id === id);
        if (existing) {
          setName(existing.name);
          setIsPublic(existing.isPublic);
          setExercises(existing.exercises);
        }
      }
    };
    loadTemplate();
  }, [id, isEditing, user.id]);

  useEffect(() => {
    const loadExercises = async () => {
      const allEx = await db.getExercises();
      setAllExercises(allEx);
      if (!exerciseSearch.trim()) {
        setExerciseResults(allEx.slice(0, 5));
      } else {
        const filtered = allEx.filter(ex =>
          ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
        );
        setExerciseResults(filtered);
      }
    };
    loadExercises();
  }, [exerciseSearch]);

  const addExercise = async (ex: Exercise | string) => {
    let finalEx: Exercise;
    if (typeof ex === 'string') {
      const trimmedName = ex.trim();
      if (!trimmedName) return;
      // Check if it exists globally again to be safe
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
      defaultSets: 3,
      defaultWeight: 0,
      defaultReps: 10
    }]);
    setExerciseSearch('');
    setShowSearch(false);
  };

  const removeExercise = (index: number) => {
    let newExs = exercises.filter((_, i) => i !== index);
    const counts = new Map<string, number>();
    newExs.forEach(e => { if (e.supersetId) counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1); });
    newExs = newExs.map(e => e.supersetId && counts.get(e.supersetId)! < 2 ? { ...e, supersetId: undefined } : e);
    setExercises(newExs);
  };

  const toggleSuperset = (idx: number) => {
    const newExs = [...exercises];
    const a = newExs[idx];
    const b = newExs[idx + 1];
    if (a.supersetId && a.supersetId === b.supersetId) {
      const groupId = a.supersetId;
      const newGroupId = Math.random().toString(36).substr(2, 9);
      for (let i = idx + 1; i < newExs.length; i++) {
        if (newExs[i].supersetId === groupId) newExs[i] = { ...newExs[i], supersetId: newGroupId };
      }
      for (const id of [groupId, newGroupId]) {
        if (newExs.filter(e => e.supersetId === id).length < 2)
          newExs.forEach((e, i) => { if (e.supersetId === id) newExs[i] = { ...e, supersetId: undefined }; });
      }
    } else {
      const supersetId = a.supersetId || b.supersetId || Math.random().toString(36).substr(2, 9);
      newExs[idx] = { ...newExs[idx], supersetId };
      newExs[idx + 1] = { ...newExs[idx + 1], supersetId };
    }
    setExercises(newExs);
  };

  const updateExercise = (index: number, updates: Partial<TemplateExercise>) => {
    const newExs = [...exercises];
    newExs[index] = { ...newExs[index], ...updates };
    setExercises(newExs);
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('Please enter a template name');
    if (exercises.length === 0) return alert('Please add at least one exercise');

    let createdAt = Date.now();
    if (isEditing) {
      const all = await db.getTemplates(user.id);
      const existing = all.find(t => t.id === id);
      createdAt = existing?.createdAt || Date.now();
    }

    const template: WorkoutTemplate = {
      id: isEditing ? id : Math.random().toString(36).substr(2, 9),
      userId: user.id,
      name,
      isPublic,
      exercises,
      createdAt
    };

    await db.saveTemplate(template);
    navigate('/templates');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex items-center gap-4">
        <button
          onClick={() => navigate('/templates')}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Edit Template' : 'New Template'}</h1>
        </div>
      </header>

      <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 outline-none text-white"
            placeholder="e.g. Upper Body Power"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2 rounded-lg">
              <Info size={18} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Public Template</p>
              <p className="text-xs text-zinc-500">Allow others to see and copy this</p>
            </div>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPublic ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold px-2">Exercises</h2>
        
        <div className="flex flex-col">
          {exercises.map((ex, idx) => {
            const isInSuperset = !!ex.supersetId;
            const isFirstInGroup = isInSuperset && (idx === 0 || exercises[idx - 1].supersetId !== ex.supersetId);
            const linkedToPrev = isInSuperset && idx > 0 && exercises[idx - 1].supersetId === ex.supersetId;
            return (
            <Fragment key={idx}>
            {idx > 0 && (
              <div className={`flex items-center gap-2 px-3 relative z-10 ${linkedToPrev ? 'my-0.5' : 'my-2'}`}>
                <div className={`flex-1 h-px ${linkedToPrev ? 'bg-indigo-500/30' : 'bg-transparent'}`} />
                <button
                  onClick={() => toggleSuperset(idx - 1)}
                  className={`flex items-center justify-center w-5 h-5 rounded-full border transition-all ${
                    linkedToPrev
                      ? 'border-indigo-500/60 text-indigo-400 bg-indigo-500/10 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                      : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <Link2 size={10} />
                </button>
                <div className={`flex-1 h-px ${linkedToPrev ? 'bg-indigo-500/30' : 'bg-transparent'}`} />
              </div>
            )}
            <div className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-left-2 duration-300 ${
              isInSuperset ? 'bg-zinc-900 border border-indigo-500/30 border-l-2 border-l-indigo-500' : 'bg-zinc-900 border border-zinc-800'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {isFirstInGroup && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                      Superset
                    </span>
                  )}
                  <h4 className="font-bold text-lg">{ex.name}</h4>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Sets</span>
                    <NumericInput
                      value={ex.defaultSets}
                      onChange={(v) => updateExercise(idx, { defaultSets: v })}
                      className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center text-sm font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">KG</span>
                    <NumericInput
                      value={ex.defaultWeight}
                      allowDecimal
                      onChange={(v) => updateExercise(idx, { defaultWeight: v })}
                      className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center text-sm font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Reps</span>
                    <NumericInput
                      value={ex.defaultReps}
                      onChange={(v) => updateExercise(idx, { defaultReps: v })}
                      className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeExercise(idx)}
                className="p-3 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all self-end sm:self-center"
              >
                <Trash2 size={20} />
              </button>
            </div>
            </Fragment>
          );})}


          {/* Add Exercise Search */}
          <div className="relative" ref={searchRef}>
            <div className={`flex items-center gap-3 bg-zinc-950 border ${showSearch ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-800'} p-4 rounded-2xl transition-all`}>
              <Search size={20} className="text-zinc-500" />
              <input
                type="text"
                value={exerciseSearch}
                onChange={(e) => {
                  setExerciseSearch(e.target.value);
                  setShowSearch(true);
                }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search exercises to add..."
                className="bg-transparent flex-1 outline-none font-medium text-white"
              />
              {showSearch && (
                <button onClick={() => setShowSearch(false)} className="text-zinc-500">
                  <X size={20} />
                </button>
              )}
            </div>

            {showSearch && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {/* Always show "Create" option if search doesn't exactly match an existing exercise */}
                {exerciseSearch.trim().length > 0 && !allExercises.some(e => e.name.toLowerCase() === exerciseSearch.trim().toLowerCase()) && (
                  <button
                    onClick={() => addExercise(exerciseSearch.trim())}
                    className="w-full text-left p-4 hover:bg-zinc-800 text-indigo-400 font-bold border-b border-zinc-800 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-600/10 p-1.5 rounded-lg group-hover:bg-indigo-600/20 transition-colors">
                        <Plus size={18} />
                      </div>
                      <span>Create "{exerciseSearch.trim()}"</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">New Exercise</span>
                  </button>
                )}

                {exerciseResults.length > 0 ? (
                  exerciseResults.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex)}
                      className="w-full text-left p-4 hover:bg-zinc-800 border-b border-zinc-800 last:border-0 flex items-center justify-between text-white"
                    >
                      <span className="font-bold">{ex.name}</span>
                      <Plus size={16} className="text-zinc-600" />
                    </button>
                  ))
                ) : !exerciseSearch.trim() && (
                   <p className="p-6 text-center text-zinc-500 text-sm">Type to search or create...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="pt-10 sticky bottom-20 md:bottom-8 z-10">
        <button
          onClick={handleSave}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Save size={20} />
          {isEditing ? 'Save Template Changes' : 'Create Template'}
        </button>
      </footer>
    </div>
  );
};

export default TemplateEditor;
