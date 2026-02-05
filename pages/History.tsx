
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, Search, Trash2, ArrowUpDown, Clock } from 'lucide-react';
import { db } from '../services/db';
import { WorkoutInstance, User } from '../types';

const History: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<WorkoutInstance[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<WorkoutInstance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      const data = await db.getInstances(user.id);
      setHistory(data);
      setFilteredHistory(data);
    };
    loadHistory();
  }, [user.id]);

  useEffect(() => {
    let result = history;
    
    if (searchTerm) {
      result = result.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (startDate) {
      const startTs = new Date(startDate).getTime();
      result = result.filter(h => h.date >= startTs);
    }

    if (endDate) {
      const endTs = new Date(endDate).getTime() + 86400000; // end of day
      result = result.filter(h => h.date <= endTs);
    }

    setFilteredHistory(result);
  }, [searchTerm, startDate, endDate, history]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Permanently delete this workout from history?')) {
      await db.deleteInstance(id);
      const data = await db.getInstances(user.id);
      setHistory(data);
    }
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(ts);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold">History</h1>
        <p className="text-zinc-400">Track your progress over time</p>
      </header>

      <section className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="Search by name..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 ml-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 ml-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {filteredHistory.map((workout) => (
          <button
            key={workout.id}
            onClick={() => navigate(`/history/${workout.id}`)}
            className="w-full group bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition-all text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Calendar size={22} />
              </div>
              <div>
                <h4 className="font-bold text-lg">{workout.name}</h4>
                <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {formatDate(workout.date)}
                  </span>
                  <span>•</span>
                  <span>{workout.exercises.length} exercises</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => handleDelete(workout.id, e)}
                className="p-3 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
              <ChevronRight className="text-zinc-600 group-hover:text-indigo-400 transition-colors" />
            </div>
          </button>
        ))}

        {filteredHistory.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-500">No matching workouts found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
