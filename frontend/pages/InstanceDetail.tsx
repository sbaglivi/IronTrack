import React, { Fragment, useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ChevronLeft, FileText, Link2, Trash2 } from 'lucide-react';
import { db } from '../services/db';
import { User, WorkoutInstance } from '../types';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const InstanceDetail: React.FC<{ user: User }> = ({ user }) => {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [instance, setInstance] = useState<WorkoutInstance | null>(null);

  useEffect(() => {
    const loadInstance = async () => {
      const all = await db.getInstances(user.id);
      const found = all.find((workout) => workout.id === id);
      if (found) setInstance(found);
      else navigate('/history');
    };
    loadInstance();
  }, [id, navigate, user.id]);

  if (!instance) return null;

  const deleteSelf = async () => {
    if (confirm('Delete this workout record?')) {
      await db.deleteInstance(instance.id);
      navigate('/history');
    }
  };

  return (
    <div className="detail-page animate-in slide-in-from-right-4 duration-300">
      <header className="detail-header">
        <button onClick={() => navigate('/history')} className="back-link">
          <ChevronLeft size={18} />
          Back to calendar
        </button>
        <button onClick={deleteSelf} className="template-icon-button danger" aria-label="Delete workout">
          <Trash2 size={18} />
        </button>
      </header>

      <section className="detail-title-slice">
        <p>{dateFormatter.format(instance.date)} at {timeFormatter.format(instance.date)}</p>
        <h1>{instance.name}</h1>
      </section>

      <section className="workout-panel read-only">
        <div className="template-panel-head">
          <h2 className="panel-title">Exercises</h2>
          <p className="panel-note">What was logged for this workout.</p>
        </div>

        <div className="workout-exercise-list">
          {instance.exercises.map((ex, exIdx) => {
            const isInSuperset = !!ex.supersetId;
            const isFirstInGroup = isInSuperset && (exIdx === 0 || instance.exercises[exIdx - 1].supersetId !== ex.supersetId);
            const linkedToPrevious = isInSuperset && exIdx > 0 && instance.exercises[exIdx - 1].supersetId === ex.supersetId;

            return (
              <Fragment key={`${ex.exerciseId}-${exIdx}`}>
                {exIdx > 0 && (
                  <div className={`superset-connector ${linkedToPrevious ? 'active' : ''}`}>
                    <span />
                    {linkedToPrevious ? <Link2 size={12} className="superset-readonly-icon" /> : <span />}
                    <span />
                  </div>
                )}

                <article className={`workout-exercise ${isInSuperset ? 'is-superset' : ''}`}>
                  <div className="workout-exercise-top">
                    <div className="workout-exercise-name">
                      {isFirstInGroup && <span className="superset-badge">Superset</span>}
                      <h3>{ex.name}</h3>
                    </div>
                    <span className="exercise-set-count">{ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="sets">
                    <div className="set-header read-only">
                      <div>Set</div>
                      <div>Weight</div>
                      <div>Reps</div>
                    </div>

                    {ex.sets.map((set, setIdx) => (
                      <div key={set.id} className="set-row read-only">
                        <div className="set-no">{setIdx + 1}</div>
                        <div className="readonly-cell">{set.weight} <span>kg</span></div>
                        <div className="readonly-cell">{set.reps} <span>reps</span></div>
                      </div>
                    ))}
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      </section>

      {instance.notes && (
        <section className="readonly-note">
          <div>
            <FileText size={16} />
            Notes
          </div>
          <p>{instance.notes}</p>
        </section>
      )}
    </div>
  );
};

export default InstanceDetail;
