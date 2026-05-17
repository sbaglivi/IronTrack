
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useLocation, useSearchParams } from 'wouter';
import { Plus, Save, Trash2, X, Search, AlertTriangle, CheckCircle2, Check, GripVertical, Link2 } from 'lucide-react';
import { db } from '../services/db';
import { InstanceExercise, WorkoutSet, Exercise, User } from '../types';
import NumericInput from '../components/NumericInput';

const WORKOUT_QUOTES = [
  'Lift heavy, count honestly.',
  'Future you gets the receipt.',
  'Strong plans. Stronger sets.',
  'The bar remembers.',
  'Tiny plates still count.',
  'Make it boring. Make it work.',
  'One more clean rep.',
  'Good form is the flex.',
];

const WorkoutSession: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');
  const draftIdParam = searchParams.get('draftId');

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<InstanceExercise[]>([]);
  const [notes, setNotes] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [workoutQuote] = useState(() => WORKOUT_QUOTES[Math.floor(Math.random() * WORKOUT_QUOTES.length)]);

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
    hasModified.current = false;
    if (draftIdRef.current) {
      await db.deleteInstance(draftIdRef.current);
    }
    navigate('/');
  };

  const handleSaveAndExit = async () => {
    hasModified.current = false;
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

  return (
    <div className="track-page animate-in slide-in-from-right-4 duration-300" onClick={() => { if (selectionExIdx !== null) clearSelection(); }}>
      <header className="workout-title-slice">
        <div className="workout-title-inner">
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="workout-name-input"
            placeholder="Workout Name"
          />
          <p className="sub workout-quote">{workoutQuote}</p>
        </div>
      </header>

      <section className="workout-panel">
        <div className="template-panel-head">
          <h2 className="panel-title">Exercises</h2>
          <p className="panel-note">Long press the right handle to select sets.</p>
        </div>

        <div className="workout-exercise-list">
          {exercises.map((ex, exIdx) => {
            const isSelecting = selectionExIdx === exIdx;
            const isInSuperset = !!ex.supersetId;
            const isFirstInGroup = isInSuperset && (exIdx === 0 || exercises[exIdx - 1].supersetId !== ex.supersetId);
            const isLinkedFromPrevious = isInSuperset && exercises[exIdx - 1]?.supersetId === ex.supersetId;
            return (
              <Fragment key={exIdx}>
                {exIdx > 0 && (
                  <div className={`superset-connector ${isLinkedFromPrevious ? 'active' : ''}`}>
                    <span />
                    <button
                      onClick={() => toggleSuperset(exIdx - 1)}
                      className="superset-toggle"
                      aria-label={isLinkedFromPrevious ? 'Remove superset link' : 'Create superset link'}
                    >
                      <Link2 size={12} />
                    </button>
                    <span />
                  </div>
                )}

                <section
                  className={`workout-exercise ${isInSuperset ? 'is-superset' : ''}`}
                  onClick={isSelecting ? (e) => e.stopPropagation() : undefined}
                >
                  <div className="workout-exercise-top">
                    {isSelecting ? (
                      <>
                        <span className="selection-count">{selectedSetIds.size} selected</span>
                        <div className="template-actions">
                          <button onClick={removeSelectedSets} className="template-icon-button danger" aria-label="Remove selected sets">
                            <Trash2 size={16} />
                          </button>
                          <button onClick={clearSelection} className="template-icon-button" aria-label="Clear selected sets">
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="workout-exercise-name">
                          {isFirstInGroup && <span className="superset-badge">Superset</span>}
                          <h3>{ex.name}</h3>
                        </div>
                        <button onClick={() => removeExercise(exIdx)} className="template-icon-button danger" aria-label={`Remove ${ex.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="sets">
                    <div className="set-header">
                      <div>Set</div>
                      <div>Weight</div>
                      <div>Reps</div>
                      <div />
                    </div>

                    {ex.sets.map((set, setIdx) => {
                      const isSelected = isSelecting && selectedSetIds.has(set.id);
                      return (
                        <div
                          key={set.id}
                          className={`set-row ${isSelected ? 'selected' : ''}`}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <div className="set-no">{setIdx + 1}</div>
                          <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                            <NumericInput
                              value={set.weight}
                              allowDecimal
                              onChange={(v) => updateSet(exIdx, setIdx, { weight: v })}
                              className="set-input"
                            />
                          </div>
                          <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                            <NumericInput
                              value={set.reps}
                              onChange={(v) => updateSet(exIdx, setIdx, { reps: v })}
                              className="set-input"
                            />
                          </div>
                          <button
                            type="button"
                            className={`set-handle ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSetClick(exIdx, set.id)}
                            onPointerDown={() => handleSetPointerDown(exIdx, set.id)}
                            onPointerUp={handleSetPointerUp}
                            onPointerCancel={handleSetPointerUp}
                            aria-label={isSelected ? `Set ${setIdx + 1} selected` : `Select set ${setIdx + 1}`}
                          >
                            {isSelecting ? (
                              <span className={`set-select-dot ${isSelected ? 'selected' : ''}`}>
                                {isSelected && <Check size={11} strokeWidth={3} />}
                              </span>
                            ) : (
                              <GripVertical size={17} />
                            )}
                          </button>
                        </div>
                      );
                    })}

                    <button onClick={() => addSet(exIdx)} className="add-set-button">
                      + Add Set
                    </button>
                  </div>
                </section>
              </Fragment>
            );
          })}

          <button onClick={() => setShowAddEx(true)} className="add-exercise-bottom">
            <span className="button-plus">+</span>
            Add Exercise
          </button>
        </div>
      </section>

      {/* Add Exercise Modal */}
      {showAddEx && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-large animate-in slide-in-from-bottom-8 duration-300">
            <div className="modal-head">
              <h3>Add Exercise</h3>
              <button onClick={() => setShowAddEx(false)} className="template-icon-button" aria-label="Close add exercise">
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="relative">
                <Search className="modal-search-icon" size={18} />
                <input
                  type="text"
                  autoFocus
                  value={exSearch}
                  onChange={(e) => setExSearch(e.target.value)}
                  className="modal-search-input"
                  placeholder="Search exercise..."
                />
              </div>
              <div className="modal-option-list">
                {/* New Prominent "Create" option */}
                {exSearch.trim().length > 0 && !allExercises.some(e => e.name.toLowerCase() === exSearch.trim().toLowerCase()) && (
                  <button
                    onClick={() => addExercise(exSearch.trim())}
                    className="modal-option primary"
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
                    className="modal-option"
                  >
                    <span>{ex.name}</span>
                    <Plus size={16} />
                  </button>
                ))}

                {exSearch.trim() === '' && (
                  <p className="modal-empty">Type an exercise name to search or create a new one.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finish Confirmation Modal */}
      {showFinishModal && (
        <div className="modal-backdrop">
          <div className="modal-card animate-in slide-in-from-bottom-8 duration-300">
            <div className="modal-summary">
              <div className="modal-icon success">
                <CheckCircle2 size={32} />
              </div>
              <h3>Finish Workout?</h3>
              <p>
                {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {exercises.reduce((n, ex) => n + ex.sets.length, 0)} sets
              </p>
            </div>
            <div className="modal-body pt-0">
              <label className="field-label block text-xs font-black uppercase tracking-widest mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                className="modal-notes"
                placeholder="How did it feel today?"
              />
              <button
                onClick={finishWorkout}
                className="modal-action primary"
              >
                <CheckCircle2 size={18} />
                Save Workout
              </button>
              <button
                onClick={() => setShowFinishModal(false)}
                className="modal-action secondary"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard/Save Confirmation Modal */}
      {showDiscardModal && (
        <div className="modal-backdrop">
          <div className="modal-card animate-in slide-in-from-bottom-8 duration-300">
            <div className="modal-summary">
              <div className="modal-icon warning">
                <AlertTriangle size={32} />
              </div>
              <h3>Leave Workout?</h3>
              <p>
                You have an active workout in progress. What would you like to do?
              </p>
            </div>
            <div className="modal-body pt-0">
              <button
                onClick={handleSaveAndExit}
                className="modal-action primary"
              >
                <Save size={18} />
                Save & Exit
              </button>
              <button
                onClick={handleDiscard}
                className="modal-action danger"
              >
                <Trash2 size={18} />
                Discard Workout
              </button>
              <button
                onClick={() => setShowDiscardModal(false)}
                className="modal-action secondary"
              >
                Keep Working
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Bottom Bar */}
      <div className="workout-action-bar">
        <button
          onClick={handleAttemptLeave}
          className="workout-bar-button exit-action"
        >
          <X size={18} />
          Exit
        </button>
        <button onClick={handleFinishClick} className="workout-bar-button finish-action">
          Finish
        </button>
      </div>
    </div>
  );
};

export default WorkoutSession;
