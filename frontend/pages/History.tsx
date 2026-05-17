import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutInstance, User } from '../types';

const dayMs = 24 * 60 * 60 * 1000;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dayKey(date: Date | number) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCalendarDays(month: Date) {
  const first = startOfMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const leadingDays = (first.getDay() + 6) % 7;
  const trailingDays = 6 - ((last.getDay() + 6) % 7);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - leadingDays);
  const totalDays = leadingDays + last.getDate() + trailingDays;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start.getTime() + index * dayMs);
    return {
      date,
      key: dayKey(date),
      isOutsideMonth: date.getMonth() !== month.getMonth(),
      label: date.getDate(),
    };
  });
}

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const History: React.FC<{ user: User }> = ({ user }) => {
  const [, navigate] = useLocation();
  const [history, setHistory] = useState<WorkoutInstance[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    const loadHistory = async () => {
      const data = await db.getInstances(user.id);
      setHistory(data);
    };
    loadHistory();
    window.addEventListener('irontrack:synced', loadHistory);
    return () => window.removeEventListener('irontrack:synced', loadHistory);
  }, [user.id]);

  const workoutsByDay = useMemo(() => {
    const grouped = new Map<string, WorkoutInstance[]>();
    for (const workout of history) {
      const key = dayKey(workout.date);
      const workouts = grouped.get(key) ?? [];
      workouts.push(workout);
      grouped.set(key, workouts);
    }
    for (const workouts of grouped.values()) {
      workouts.sort((a, b) => b.date - a.date);
    }
    return grouped;
  }, [history]);

  const days = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);
  const weeks = useMemo(() => {
    const rows = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  const openDay = (key: string) => {
    const latestWorkout = workoutsByDay.get(key)?.[0];
    if (latestWorkout) navigate(`/history/${latestWorkout.id}`);
  };

  return (
    <div className="history-page animate-in fade-in duration-500">
      <header className="history-header">
        <div>
          <h1 className="plan-heading">Review</h1>
        </div>
      </header>

      <section className="calendar-panel">
        <div className="calendar-toolbar">
          <button
            className="calendar-arrow"
            onClick={() => setCurrentMonth((month) => addMonths(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <strong>{monthFormatter.format(currentMonth)}</strong>
          <button
            className="calendar-arrow"
            onClick={() => setCurrentMonth((month) => addMonths(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="calendar-grid">
          <div className="weekday-row">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
            <div>Sun</div>
          </div>

          {weeks.map((week) => (
            <div key={week[0].key} className="week-row">
              {week.map((day) => {
                const workouts = workoutsByDay.get(day.key);
                const hasWorkout = !!workouts?.length;
                const Component = hasWorkout ? 'button' : 'div';

                return (
                  <Component
                    key={day.key}
                    className={`calendar-day ${day.isOutsideMonth ? 'outside' : ''} ${hasWorkout ? 'workout' : ''}`}
                    onClick={hasWorkout ? () => openDay(day.key) : undefined}
                    aria-label={hasWorkout ? `${workouts[0].name}, ${day.date.toLocaleDateString()}` : undefined}
                  >
                    <span>{day.label}</span>
                  </Component>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default History;
