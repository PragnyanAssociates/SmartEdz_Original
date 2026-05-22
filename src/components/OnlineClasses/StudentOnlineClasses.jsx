import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { Video, PlayCircle, Search, X, Loader2, Calendar, Clock } from 'lucide-react';

export default function StudentOnlineClasses() {
  const { user } = useAuth();
  
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('live'); 

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/online-classes/student/${user.id}`);
      const d = await res.json();
      setClassesList(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = classesList.filter(c => c.class_type === view);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => 
        (c.title || '').toLowerCase().includes(q) ||
        (c.subject_name || '').toLowerCase().includes(q) ||
        (c.teacher_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [classesList, view, query]);

  const handleJoinOrWatch = (c) => {
    if (c.class_type === 'live' && c.meet_link) window.open(c.meet_link, '_blank');
    if (c.class_type === 'recorded' && c.video_path) window.open(`${API_BASE_URL.replace('/api', '')}${c.video_path}`, '_blank');
  };

  const classLabel = (c) => `${c.className}${c.section ? ` - ${c.section}` : ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center text-center gap-1">
        <h1 className="text-xl lg:text-2xl font-black text-slate-800">Online Classes</h1>
        <p className="text-sm text-slate-500 font-medium">Join your live sessions or watch recorded lectures.</p>
      </div>

      <div className="flex justify-center mb-2">
        <div className="inline-flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setView('live')}
            className={`px-6 py-2 rounded-lg font-bold transition-all text-sm ${view === 'live' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
            Live Classes
          </button>
          <button onClick={() => setView('recorded')}
            className={`px-6 py-2 rounded-lg font-bold transition-all text-sm ${view === 'recorded' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
            Recorded Classes
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search classes…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full shadow-sm" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={loadData} disabled={loading} className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-slate-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No {view} classes scheduled for you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(c => {
            const dt = new Date(c.class_datetime);
            return (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-blue-700 font-bold text-sm">{dt.toLocaleDateString()}</span>
                    <span className="text-slate-500 text-xs font-bold ml-2">{dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  {c.topic && <span className="bg-blue-50 text-blue-700 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full">{c.topic}</span>}
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight mb-2">{c.title}</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-xs font-medium text-slate-600">
                    <div className="flex flex-col"><span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Subject</span><span className="truncate">{c.subject_name}</span></div>
                    <div className="flex flex-col"><span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Class</span><span className="truncate">{c.className ? classLabel(c) : 'All Classes'}</span></div>
                    <div className="col-span-2 flex flex-col"><span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Teacher</span><span>{c.teacher_name}</span></div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100">
                  <button onClick={() => handleJoinOrWatch(c)} className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl text-sm text-white shadow-md transition-all ${c.class_type === 'live' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    {c.class_type === 'live' ? <><Video size={16}/> Join Live Class</> : <><PlayCircle size={16}/> Watch Recording</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}