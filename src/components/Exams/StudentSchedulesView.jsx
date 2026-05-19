import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Loader2, CalendarDays } from 'lucide-react';
import { ScheduleDetailView } from './SchedulesManager';

// =====================================================================
//  StudentSchedulesView — read-only listing of schedules for the
//  logged-in student's class.
// =====================================================================

export default function StudentSchedulesView() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [tab, setTab] = useState('Internal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/exam-schedules/student/${user.id}`)
      .then(r => r.json())
      .then(d => setSchedules(Array.isArray(d) ? d : []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(
    () => schedules.filter(s => s.exam_type === tab),
    [schedules, tab]
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          {['Internal', 'External'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'Internal' ? 'School Exams' : 'Govt Schedule'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No {tab.toLowerCase()} schedules published yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(s => <ScheduleDetailView key={s.id} schedule={s} />)}
        </div>
      )}
    </div>
  );
}