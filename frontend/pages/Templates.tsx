
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Plus, Search, Copy, Edit2, Trash2, Globe, Lock, Play, X, Check, ClipboardList } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutTemplate, Exercise, User } from '../types';

const Templates: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      const data = await db.getTemplates(user.id);
      setTemplates(data);
    };
    loadTemplates();
  }, [user.id]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await db.deleteTemplate(id);
      const data = await db.getTemplates(user.id);
      setTemplates(data);
    }
  };

  const handleCopy = async (template: WorkoutTemplate) => {
    const newTemplate: WorkoutTemplate = {
      ...template,
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      name: `${template.name} (Copy)`,
      isPublic: false,
      createdAt: Date.now()
    };
    await db.saveTemplate(newTemplate);
    const data = await db.getTemplates(user.id);
    setTemplates(data);
  };

  const startWorkout = (template: WorkoutTemplate) => {
    navigate(`/workout/new?templateId=${template.id}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-zinc-400">Your routines and shared workouts</p>
        </div>
        <button
          onClick={() => navigate('/templates/new')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="group relative bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-zinc-700 transition-all overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl -z-0 pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">{template.name}</h3>
                  {/* Fixed: Wrapped Lucide icons in a span to provide 'title' functionality and fix TypeScript error */}
                  {template.isPublic ? (
                    <span title="Public">
                      <Globe size={14} className="text-zinc-500" />
                    </span>
                  ) : (
                    <span title="Private">
                      <Lock size={14} className="text-zinc-500" />
                    </span>
                  )}
                </div>
                <p className="text-zinc-400 text-sm mb-4">
                  {template.exercises.length} exercises • {template.userId === user.id ? 'Created by you' : 'Shared with you'}
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
                  onClick={() => startWorkout(template)}
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
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-3 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleCopy(template)}
                      className="p-3 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all"
                      title="Copy to My Templates"
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
            <p className="text-zinc-500">No templates found.</p>
            <button
              onClick={() => navigate('/templates/new')}
              className="mt-4 text-indigo-400 font-bold hover:underline"
            >
              Create your first template
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Templates;
