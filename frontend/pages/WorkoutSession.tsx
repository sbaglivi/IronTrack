
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useLocation, useSearchParams } from 'wouter';
import { Plus, Save, Trash2, X, MoreVertical, Search, Clock, AlertTriangle, CheckCircle2, Check, GripVertical, Link2 } from 'lucide-react';
import { db } from '../services/db';
import { InstanceExercise, WorkoutSet, Exercise, User } from '../types';
import NumericInput from '../components/NumericInput';

const WorkoutSession: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');
  const draftIdParam = searchParams.get('draftId');

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<InstanceExercise[]>([]);
  const [notes, setNotes] = useState('');
  const [startTime] = useState(Date.now());
  const [timerOffset, setTimerOffset] = useState(0);
  const [timer, setTimer] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);

  // For adding new exercises to the instance
  const [showAddEx, setShowAddEx] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [exResults, setExResults] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  // Multi-set selection
  const [selectionExIdx, setSelectionExIdx] = useState<number | null>(null);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  // Navigation guard
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Tracks whether the user has made any modification this session
  const hasModified = useRef(false);

  // Refs for latest state in event handlers
  const exercisesRef = useRef(exercises);
  const notesRef = useRef(notes);
  const nameRef = useRef(name);
  const draftIdRef = useRef(draftId);
  exercisesRef.current = exercises;
  notesRef.current = notes;
  nameRef.current = name;
  draftIdRef.current = draftId;

  // Original workout date (preserved across saves)
  const sessionDate = useRef(Date.now());

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer(timerOffset + Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime, timerOffset]);

  // Initialize session: resume draft or start fresh
  useEffect(() => {
    const initSession = async () => {
      if (draftIdParam) {
        // Resume existing draft by ID
        try {
          const existingDraft = await db.getInstance(draftIdParam);
          if (existingDraft && existingDraft.isDraft) {
            setName(existingDraft.name);
            setExercises(existingDraft.exercises);
            setNotes(existingDraft.notes);
            setDraftId(existingDraft.id);
            sessionDate.current = existingDraft.date;
            setTimerOffset(Math.floor((Date.now() - existingDraft.date) / 1000));
            // Resumed draft counts as having work to preserve
            hasModified.current = true;
            return;
          }
        } catch {
          // Draft not found, fall through to create fresh session
        }
      }

      // Clean up any leftover draft before starting fresh
      const leftoverDraft = await db.getDraft();
      if (leftoverDraft) {
        await db.deleteInstance(leftoverDraft.id);
      }

      // Build session from template or empty
      let sessionName = `Workout ${new Intl.DateTimeFormat('en-US').format(new Date())}`;
      let sessionExercises: InstanceExercise[] = [];

      if (templateId) {
        const templates = await db.getTemplates(user.id);
        const template = templates.find(t => t.id === templateId);
        if (template) {
          sessionName = template.name;
          sessionExercises = template.exercises.map(te => ({
            exerciseId: te.exerciseId,
            name: te.name,
            supersetId: te.supersetId,
            sets: Array.from({ length: te.defaultSets }, () => ({
              id: Math.random().toString(36).substr(2, 9),
              weight: te.defaultWeight,
              reps: te.defaultReps || 10,
            }))
          }));
        }
      }

      setName(sessionName);
      setExercises(sessionExercises);
      sessionDate.current = Date.now();
      // No draft created yet — will be created on first user modification
    };

    initSession();
  }, [templateId, user.id, draftIdParam]);

  // Load exercises for search
  useEffect(() => {
    const loadExercises = async () => {
      const all = await db.getExercises();
      setAllExercises(all);
      if (!exSearch.trim()) setExResults(all.slice(0, 5));
      else setExResults(all.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase())));
    };
    loadExercises();
  }, [exSearch]);

  // Save draft: creates if no draftId, updates if exists. Uses refs for latest state.
  const saveDraft = useCallback(async () => {
    if (!hasModified.current) return;

    const currentDraftId = draftIdRef.current;
    const draftData = {
      userId: user.id,
      templateId: templateId || undefined,
      name: nameRef.current || 'Untitled Workout',
      date: sessionDate.current,
      exercises: exercisesRef.current,
      notes: notesRef.current,
      isDraft: true as const,
    };

    try {
      if (currentDraftId) {
        const saved = await db.saveInstance({ id: currentDraftId, ...draftData });
        if (saved.id !== currentDraftId) setDraftId(saved.id);
      } else {
        const saved = await db.createInstance(draftData);
        setDraftId(saved.id);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [user.id, templateId]);

  // Mark session as modified and schedule a debounced save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const markDirty = useCallback(() => {
    hasModified.current = true;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveDraft, 500);
  }, [saveDraft]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  // Auto-save every 30 seconds (only if modified)
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasModified.current && draftIdRef.current) saveDraft();
    }, 30_000);
    return () => clearInterval(interval);
  }, [saveDraft]);

  // Navigation guard: beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasModified.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Navigation guard: browser back button (popstate)
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (hasModified.current) {
        window.history.pushState(null, '', window.location.href);
        setShowDiscardModal(true);
      } else {
        navigate('/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  const handleAttemptLeave = () => {
    if (hasModified.current) {
      setShowDiscardModal(true);
    } else {
      navigate('/');
    }
  };

  const handleDiscard = async () => {
    if (draftIdRef.current) {
      await db.deleteInstance(draftIdRef.current);
    }
    navigate('/');
  };

  const handleSaveAndExit = async () => {
    await saveDraft();
    navigate('/');
  };

  const addSet = (exIndex: number) => {
    const newExs = [...exercises];
    const lastSet = newExs[exIndex].sets[newExs[exIndex].sets.length - 1];
    newExs[exIndex].sets.push({
      id: Math.random().toString(36).substr(2, 9),
      weight: lastSet ? lastSet.weight : 0,
      reps: lastSet ? lastSet.reps : 10,
    });
    setExercises(newExs);
    markDirty();
  };

  const updateSet = (exIndex: number, setIndex: number, updates: Partial<WorkoutSet>) => {
    const newExs = [...exercises];
    const setId = newExs[exIndex].sets[setIndex].id;
    if (selectionExIdx === exIndex && selectedSetIds.has(setId)) {
      newExs[exIndex].sets = newExs[exIndex].sets.map(s =>
        selectedSetIds.has(s.id) ? { ...s, ...updates } : s
      );
    } else {
      newExs[exIndex].sets[setIndex] = { ...newExs[exIndex].sets[setIndex], ...updates };
    }
    setExercises(newExs);
    markDirty();
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    const newExs = [...exercises];
    newExs[exIndex].sets = newExs[exIndex].sets.filter((_, i) => i !== setIndex);
    setExercises(newExs);
    markDirty();
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
      sets: [{ id: Math.random().toString(36).substr(2, 9), weight: 0, reps: 10 }]
    }]);
    setShowAddEx(false);
    setExSearch('');
    markDirty();
  };

  const removeExercise = (index: number) => {
    if (confirm('Remove this exercise from session?')) {
      if (selectionExIdx === index) clearSelection();
      let newExs = exercises.filter((_, i) => i !== index);
      // Clean up supersets that now have only 1 member
      const counts = new Map<string, number>();
      newExs.forEach(e => { if (e.supersetId) counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1); });
      newExs = newExs.map(e => e.supersetId && counts.get(e.supersetId)! < 2 ? { ...e, supersetId: undefined } : e);
      setExercises(newExs);
      markDirty();
    }
  };

  const clearSelection = () => {
    setSelectionExIdx(null);
    setSelectedSetIds(new Set());
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
    markDirty();
  };

  const removeSelectedSets = () => {
    if (selectionExIdx === null) return;
    const newExs = [...exercises];
    newExs[selectionExIdx].sets = newExs[selectionExIdx].sets.filter(s => !selectedSetIds.has(s.id));
    setExercises(newExs);
    markDirty();
    clearSelection();
  };

  const handleSetPointerDown = (exIdx: number, setId: string) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setSelectionExIdx(exIdx);
      setSelectedSetIds(new Set([setId]));
    }, 500);
  };

  const handleSetPointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSetClick = (exIdx: number, setId: string) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (selectionExIdx !== exIdx) return;
    setSelectedSetIds(prev => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
        if (next.size === 0) setSelectionExIdx(null);
      } else {
        next.add(setId);
      }
      return next;
    });
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    markDirty();
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    markDirty();
  };

  const handleFinishClick = () => {
    if (exercises.length === 0) return alert('Add at least one exercise');
    setShowFinishModal(true);
  };

  const finishWorkout = async () => {

    const instanceData = {
      userId: user.id,
      templateId: templateId || undefined,
      name: name || 'Untitled Workout',
      date: sessionDate.current,
      exercises,
      notes,
      isDraft: false as const,
    };

    if (draftIdRef.current) {
      await db.saveInstance({ id: draftIdRef.current, ...instanceData });
    } else {
      await db.createInstance(instanceData);
    }
    navigate('/history');
  };

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-20 animate-in slide-in-from-right-4 duration-300">
      <header>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-3xl font-extrabold bg-transparent outline-none w-full border-b border-transparent focus:border-zinc-800 transition-colors text-white"
          placeholder="Workout Name"
        />
      </header>

      <div className="flex flex-col">
        {exercises.map((ex, exIdx) => {
          const isSelecting = selectionExIdx === exIdx;
          const isInSuperset = !!ex.supersetId;
          const isFirstInGroup = isInSuperset && (exIdx === 0 || exercises[exIdx - 1].supersetId !== ex.supersetId);
          const nextEx = exercises[exIdx + 1];
          const isLinkedToNext = isInSuperset && nextEx?.supersetId === ex.supersetId;
          return (
          <Fragment key={exIdx}>
          {exIdx > 0 && (
            <div className={`flex items-center gap-2 px-3 relative z-10 ${isInSuperset && exercises[exIdx - 1].supersetId === ex.supersetId ? 'my-0.5' : 'my-2'}`}>
              <div className={`flex-1 h-px ${isInSuperset && exercises[exIdx - 1].supersetId === ex.supersetId ? 'bg-indigo-500/30' : 'bg-transparent'}`} />
              <button
                onClick={() => toggleSuperset(exIdx - 1)}
                className={`flex items-center justify-center w-5 h-5 rounded-full border transition-all ${
                  isInSuperset && exercises[exIdx - 1].supersetId === ex.supersetId
                    ? 'border-indigo-500/60 text-indigo-400 bg-indigo-500/10 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                    : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'
                }`}
              >
                <Link2 size={10} />
              </button>
              <div className={`flex-1 h-px ${isInSuperset && exercises[exIdx - 1].supersetId === ex.supersetId ? 'bg-indigo-500/30' : 'bg-transparent'}`} />
            </div>
          )}
          <section className={`bg-zinc-900 rounded-2xl overflow-hidden shadow-sm ${
            isInSuperset ? 'border border-indigo-500/30 border-l-2 border-l-indigo-500' : 'border border-zinc-800'
          }`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-800/20">
              {isSelecting ? (
                <>
                  <span className="text-sm font-bold text-indigo-400">
                    {selectedSetIds.size} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={removeSelectedSets} className="text-zinc-400 hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                    <button onClick={clearSelection} className="text-zinc-400 hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    {isFirstInGroup && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                        Superset
                      </span>
                    )}
                    <h3 className="text-base font-bold text-indigo-400 truncate">{ex.name}</h3>
                  </div>
                  <button onClick={() => removeExercise(exIdx)} className="text-zinc-500 hover:text-red-400 transition-colors ml-2 shrink-0">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>

            <div className="px-3 pt-2 pb-3 space-y-1.5">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5 text-center">Weight (kg)</div>
                <div className="col-span-5 text-center">Reps</div>
                <div className="col-span-1"></div>
              </div>

              {ex.sets.map((set, setIdx) => {
                const isSelected = isSelecting && selectedSetIds.has(set.id);
                return (
                <div
                  key={set.id}
                  className={`grid grid-cols-12 gap-2 items-center py-1 px-2 rounded-lg transition-all select-none
                    ${isSelected ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30' : 'bg-zinc-950/50'}`}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    <span className="font-bold text-zinc-500 text-sm">{setIdx + 1}</span>
                  </div>
                  <div className="col-span-5" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <NumericInput
                      value={set.weight}
                      allowDecimal
                      onChange={(v) => updateSet(exIdx, setIdx, { weight: v })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-center font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="col-span-5" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <NumericInput
                      value={set.reps}
                      onChange={(v) => updateSet(exIdx, setIdx, { reps: v })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 text-center font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div
                    className="col-span-1 flex items-center justify-center h-full touch-none cursor-pointer"
                    onClick={() => handleSetClick(exIdx, set.id)}
                    onPointerDown={() => handleSetPointerDown(exIdx, set.id)}
                    onPointerUp={handleSetPointerUp}
                    onPointerCancel={handleSetPointerUp}
                  >
                    {isSelecting ? (
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                        ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'}`}>
                        {isSelected && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                    ) : (
                      <GripVertical size={16} className="text-zinc-600" />
                    )}
                  </div>
                </div>
              )})}

              <button
                onClick={() => addSet(exIdx)}
                className="w-full py-1.5 bg-zinc-800/50 border border-dashed border-zinc-700 rounded-lg text-zinc-400 font-bold text-sm hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                + Add Set
              </button>
            </div>
          </section>
          </Fragment>
        )})}
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
            onChange={(e) => handleNotesChange(e.target.value)}
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

      {/* Finish Confirmation Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Finish Workout?</h3>
              <p className="text-zinc-400 text-sm">
                {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {exercises.reduce((n, ex) => n + ex.sets.length, 0)} sets
              </p>
            </div>
            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={finishWorkout}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Save Workout
              </button>
              <button
                onClick={() => setShowFinishModal(false)}
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard/Save Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle size={32} className="text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Leave Workout?</h3>
              <p className="text-zinc-400 text-sm">
                You have an active workout in progress. What would you like to do?
              </p>
            </div>
            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={handleSaveAndExit}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Save & Exit
              </button>
              <button
                onClick={handleDiscard}
                className="w-full py-4 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-400 font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Discard Workout
              </button>
              <button
                onClick={() => setShowDiscardModal(false)}
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
              >
                Keep Working
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 z-40 flex items-center justify-between px-4 h-16">
        <button
          onClick={handleAttemptLeave}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full font-mono font-bold text-sm">
          <Clock size={15} />
          {formatTimer(timer)}
        </div>
        <button
          onClick={handleFinishClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
        >
          Finish
        </button>
      </div>
    </div>
  );
};

export default WorkoutSession;
