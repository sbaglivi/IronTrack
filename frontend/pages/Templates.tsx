
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Plus, Copy, Edit2, Trash2, Globe, Lock, Play, ClipboardList } from 'lucide-react';
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Templates</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/workout/new')}
            className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-2"
          >
            Start Empty
          </button>
          <button
            onClick={() => navigate('/templates/new')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus size={22} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="group relative bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-zinc-700 transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl -z-0 pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">{template.name}</h3>
                  {template.isPublic ? (
                    <Globe size={14} className="text-zinc-500" />
                  ) : (
                    <Lock size={14} className="text-zinc-500" />
                  )}
                </div>
                <p className="text-zinc-400 text-sm mb-4">
                  {template.exercises.length} exercises &middot; {template.userId === user.id ? 'Created by you' : 'Shared with you'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {template.exercises.slice(0, 3).map((ex, idx) => (
                    <span key={idx} className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-lg">
                      {ex.name}
                    </span>
                  ))}
                  {template.exercises.length > 3 && (
                    <span className="px-3 py-1 bg-zinc-800 text-zinc-500 text-xs font-medium rounded-lg">
                      +{template.exercises.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/workout/new?templateId=${template.id}`)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
                >
                  <Play size={18} fill="currentColor" />
                  Start
                </button>

                <div className="flex items-center gap-1">
                  {template.userId === user.id ? (
                    <>
                      <button
                        onClick={() => navigate(`/templates/edit/${template.id}`)}
                        className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-3 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleCopy(template)}
                      className="p-3 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all"
                    >
                      <Copy size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-3xl">
            <ClipboardList size={48} className="mx-auto text-zinc-700 mb-4" />
            <p className="text-zinc-500 mb-4">No templates yet.</p>
            <button
              onClick={() => navigate('/templates/new')}
              className="text-indigo-400 font-bold hover:underline"
            >
              Create your first template
            </button>
          </div>
        )}

        {/* Spacer so content isn't hidden behind the fixed draft banner on mobile */}
        {draft && <div className="h-20 md:hidden" />}
      </div>

      {/* Draft resume banner — fixed above bottom nav on mobile, static at bottom on desktop */}
      {draft && (
        <>
          <button
            onClick={() => navigate(`/workout/new?draftId=${draft.id}`)}
            className="fixed bottom-16 inset-x-0 mx-3 z-30 md:hidden flex items-center justify-between bg-amber-500/15 border border-amber-500/40 backdrop-blur-sm rounded-2xl px-5 py-3.5 active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-0.5">Resume Workout</p>
              <p className="text-sm text-zinc-300 font-medium">{draft.name}</p>
            </div>
            <Play size={20} className="text-amber-400 fill-amber-400 shrink-0" />
          </button>

          <button
            onClick={() => navigate(`/workout/new?draftId=${draft.id}`)}
            className="hidden md:flex w-full items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-3xl px-6 py-4 hover:bg-amber-500/20 transition-all active:scale-[0.98]"
          >
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">Resume Workout</p>
              <p className="text-zinc-300 font-medium">{draft.name} &middot; {draft.exercises.length} exercise{draft.exercises.length !== 1 ? 's' : ''}</p>
            </div>
            <Play size={22} className="text-amber-400 fill-amber-400 shrink-0" />
          </button>
        </>
      )}
    </div>
  );
};

export default Templates;
