
import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChevronLeft, Plus, Search, Trash2, Save, X } from 'lucide-react';
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
    <div className="template-editor-page animate-in fade-in slide-in-from-bottom-4">
      <header className="editor-title">
        <button
          onClick={() => navigate('/templates')}
          className="editor-back-button"
          aria-label="Back to Train"
        >
          <ChevronLeft size={22} />
        </button>
        <h1>{isEditing ? 'Edit Template' : 'New Template'}</h1>
      </header>

      <section className="template-editor-form">
        <div>
          <label className="field-label block text-xs font-black uppercase tracking-widest mb-2">Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-field w-full rounded-2xl px-4 py-3 outline-none font-bold"
            placeholder="e.g. Upper Body Power"
          />
        </div>

        <div className="public-toggle-row">
          <div>
            <p>Public Template</p>
            <span>Allow others to see and copy this</span>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`switch ${isPublic ? 'on' : ''}`}
            aria-label={isPublic ? 'Make template private' : 'Make template public'}
          >
            <span />
          </button>
        </div>
      </section>

      <section className="template-panel template-editor-exercises">
        <div className="template-panel-head">
          <h2 className="panel-title">Exercises</h2>
        </div>

        <div className="workout-exercise-list">
          {exercises.map((ex, idx) => {
            const isInSuperset = !!ex.supersetId;
            const linkedToPrev = isInSuperset && idx > 0 && exercises[idx - 1].supersetId === ex.supersetId;
            return (
            <Fragment key={idx}>
            {idx > 0 && (
              <div className={`superset-connector ${linkedToPrev ? 'active' : ''}`}>
                <span />
                <button
                  onClick={() => toggleSuperset(idx - 1)}
                  className="superset-toggle template-superset-toggle"
                  aria-label={linkedToPrev ? 'Remove superset link' : 'Create superset link'}
                >
                  Superset
                </button>
                <span />
              </div>
            )}
            <article className={`workout-exercise ${isInSuperset ? 'is-superset' : ''} animate-in fade-in slide-in-from-left-2 duration-300`}>
              <div className="workout-exercise-top">
                <div className="workout-exercise-name">
                  <h3>{ex.name}</h3>
                </div>
                <button
                  onClick={() => removeExercise(idx)}
                  className="template-icon-button danger"
                  aria-label={`Remove ${ex.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="template-defaults">
                  <label>
                    <span>Sets</span>
                    <NumericInput
                      value={ex.defaultSets}
                      onChange={(v) => updateExercise(idx, { defaultSets: v })}
                      className="set-input"
                    />
                  </label>
                  <label>
                    <span>KG</span>
                    <NumericInput
                      value={ex.defaultWeight}
                      allowDecimal
                      onChange={(v) => updateExercise(idx, { defaultWeight: v })}
                      className="set-input"
                    />
                  </label>
                  <label>
                    <span>Reps</span>
                    <NumericInput
                      value={ex.defaultReps}
                      onChange={(v) => updateExercise(idx, { defaultReps: v })}
                      className="set-input"
                    />
                  </label>
              </div>
            </article>
            </Fragment>
          );})}


          {/* Add Exercise Search */}
          <div className="template-search" ref={searchRef}>
            <div
              className={`template-search-input ${showSearch ? 'active' : ''}`}
              onClick={() => setShowSearch(true)}
            >
              <Search size={20} />
              <input
                type="text"
                value={exerciseSearch}
                onChange={(e) => {
                  setExerciseSearch(e.target.value);
                  setShowSearch(true);
                }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search exercises to add..."
                className="outline-none font-medium"
              />
              {showSearch && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearch(false);
                  }}
                  className="template-icon-button"
                  aria-label="Close exercise search"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {showSearch && (
              <div className="template-search-menu">
                {/* Always show "Create" option if search doesn't exactly match an existing exercise */}
                {exerciseSearch.trim().length > 0 && !allExercises.some(e => e.name.toLowerCase() === exerciseSearch.trim().toLowerCase()) && (
                  <button
                    onClick={() => addExercise(exerciseSearch.trim())}
                    className="modal-option primary"
                  >
                    <div className="flex items-center gap-3">
                      <Plus size={18} />
                      <span>Create "{exerciseSearch.trim()}"</span>
                    </div>
                    <span>New</span>
                  </button>
                )}

                {exerciseResults.length > 0 ? (
                  exerciseResults.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex)}
                      className="modal-option"
                    >
                      <span>{ex.name}</span>
                      <Plus size={16} />
                    </button>
                  ))
                ) : !exerciseSearch.trim() && (
                   <p className="modal-empty">Type to search or create...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="template-editor-footer">
        <button
          onClick={handleSave}
          className="modal-action primary"
        >
          <Save size={20} />
          {isEditing ? 'Save Template Changes' : 'Create Template'}
        </button>
      </footer>
    </div>
  );
};

export default TemplateEditor;
