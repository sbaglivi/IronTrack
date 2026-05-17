
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Copy, Pencil, Trash2, Play, ClipboardList } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutTemplate, WorkoutInstance, User } from '../types';

const Templates: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [draft, setDraft] = useState<WorkoutInstance | null>(null);

  useEffect(() => {
    const load = async () => {
      const [data, existingDraft] = await Promise.all([
        db.getTemplates(user.id),
        db.getDraft(),
      ]);
      setTemplates(data);
      setDraft(existingDraft);
    };
    load();
    window.addEventListener('irontrack:synced', load);
    return () => window.removeEventListener('irontrack:synced', load);
  }, [user.id]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await db.deleteTemplate(id);
      setTemplates(await db.getTemplates(user.id));
    }
  };

  const handleCopy = async (template: WorkoutTemplate) => {
    const newTemplate: WorkoutTemplate = {
      ...template,
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      name: `${template.name} (Copy)`,
      isPublic: false,
      createdAt: Date.now(),
    };
    await db.saveTemplate(newTemplate);
    setTemplates(await db.getTemplates(user.id));
  };

  return (
    <div className="plan-page animate-in fade-in duration-500">
      <header className="train-header">
        <div>
          <h1 className="plan-heading">Train</h1>
        </div>
      </header>

      <section className="template-panel">
        <div className="template-panel-head">
          <h2 className="panel-title">Templates</h2>
        </div>

        <div className="template-list">
          {templates.map((template) => (
            <article key={template.id} className="template-card">
              <div className="template-card-body">
                <div className="template-card-top">
                  <div className="min-w-0">
                    <h3 className="template-card-title truncate">{template.name}</h3>
                  </div>

                  <div className="template-actions">
                    {template.userId === user.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="template-icon-button danger"
                        aria-label={`Delete ${template.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => navigate(`/templates/edit/${template.id}`)}
                        className="template-icon-button"
                        aria-label={`Edit ${template.name}`}
                      >
                        <Pencil size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleCopy(template)}
                      className="template-icon-button"
                      aria-label={`Copy ${template.name}`}
                    >
                      <Copy size={18} />
                    </button>
                  )}
                  </div>
                </div>

                <div className="exercise-chip-row" aria-label={`${template.name} exercises`}>
                  {template.exercises.map((ex, idx) => (
                    <span key={`${ex.exerciseId}-${idx}`} className="exercise-chip" title={ex.name}>
                      {ex.name}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigate(`/workout/new?templateId=${template.id}`)}
                className="template-start"
              >
                <span>Start</span>
              </button>
            </article>
          ))}

        {templates.length === 0 && (
          <div className="surface-muted text-center py-20 border-2 border-dashed rounded-2xl">
            <ClipboardList size={48} className="mx-auto page-subtitle mb-4" />
            <p className="page-subtitle mb-4">No templates yet.</p>
            <button
              onClick={() => navigate('/templates/new')}
              className="text-[var(--color-primary)] font-bold hover:underline"
            >
              Create your first template
            </button>
          </div>
        )}

          <button
            onClick={() => navigate('/templates/new')}
            className="create-template-row"
          >
            <span className="create-icon">+</span>
            <span>New template</span>
          </button>
        </div>
      </section>

        {/* Spacer so content isn't hidden behind the fixed draft banner on mobile */}
        {draft && <div className="h-20 md:hidden" />}

      {/* Draft resume banner — fixed above bottom nav on mobile, static at bottom on desktop */}
      {draft && (
        <>
          <button
            onClick={() => navigate(`/workout/new?draftId=${draft.id}`)}
            className="resume-banner fixed bottom-16 inset-x-0 mx-3 z-30 md:hidden flex items-center justify-between backdrop-blur-sm rounded-2xl px-5 py-3.5 active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest mb-0.5">Resume Workout</p>
              <p className="text-sm font-medium">{draft.name}</p>
            </div>
            <Play size={20} className="fill-current shrink-0" />
          </button>

          <button
            onClick={() => navigate(`/workout/new?draftId=${draft.id}`)}
            className="resume-banner hidden md:flex w-full items-center justify-between rounded-2xl px-6 py-4 transition-all active:scale-[0.98]"
          >
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest mb-1">Resume Workout</p>
              <p className="font-medium">{draft.name} &middot; {draft.exercises.length} exercise{draft.exercises.length !== 1 ? 's' : ''}</p>
            </div>
            <Play size={22} className="fill-current shrink-0" />
          </button>
        </>
      )}
    </div>
  );
};

export default Templates;
