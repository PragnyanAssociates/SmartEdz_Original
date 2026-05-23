import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, FlaskConical, Video, LinkIcon, Radio, ExternalLink,
  Search, BookOpen, Clock, ArrowLeft, User
} from 'lucide-react';

// =====================================================================
//  StudentLabs — a student browses the digital labs posted for their
//  class, opens a lab, and watches videos / opens links / joins live
//  classes.
//
//  Two views:
//   'list'   → grid of labs for the student's class
//   'detail' → one lab with all its resources
// =====================================================================

const fmtDateTime = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Meta for each resource type
function resMeta(type) {
  switch (type) {
    case 'video': return { icon: Video,    label: 'Video',      color: 'text-rose-600',    bg: 'bg-rose-50' };
    case 'live':  return { icon: Radio,    label: 'Live Class', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    default:      return { icon: LinkIcon, label: 'Link',       color: 'text-blue-600',    bg: 'bg-blue-50' };
  }
}

export default function StudentLabs() {
  const { user } = useAuth();

  const [labs, setLabs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [openLab, setOpenLab] = useState(null);   // lab object for detail view

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/student/${user.id}`);
      const d = await res.json();
      setLabs(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return labs;
    const q = query.toLowerCase();
    return labs.filter(l =>
      (l.title || '').toLowerCase().includes(q) ||
      (l.subject_name || '').toLowerCase().includes(q));
  }, [labs, query]);

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  // --- DETAIL VIEW -----------------------------------------------
  if (openLab) {
    return <LabDetail lab={openLab} onBack={() => setOpenLab(null)} />;
  }

  // --- LIST VIEW -------------------------------------------------
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FlaskConical className="text-blue-600" size={28} />
          Digital Labs
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Watch lab videos, open resources and join live classes.
        </p>
      </div>

      {labs.length > 0 && (
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search labs…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-72" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No labs posted for your class yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lab => {
            const counts = (lab.resources || []).reduce((acc, r) => {
              acc[r.resource_type] = (acc[r.resource_type] || 0) + 1;
              return acc;
            }, {});
            return (
              <button key={lab.id} onClick={() => setOpenLab(lab)}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col text-left hover:border-blue-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <FlaskConical size={20} />
                </div>
                <h3 className="font-black text-slate-800 mt-3">{lab.title}</h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  {lab.subject_name || 'General'}
                  {lab.created_by_name ? ` · ${lab.created_by_name}` : ''}
                </p>
                {lab.description && (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{lab.description}</p>
                )}
                <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                  {['video', 'link', 'live'].map(t => counts[t] ? (
                    <ResourceTag key={t} type={t} count={counts[t]} />
                  ) : null)}
                  {(lab.resources || []).length === 0 && (
                    <span className="text-[11px] text-slate-300 italic">No resources</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  LAB DETAIL — all resources of one lab
// =====================================================================
function LabDetail({ lab, onBack }) {
  const resources = lab.resources || [];

  // group: live classes first, then videos, then links
  const ordered = useMemo(() => {
    const rank = { live: 0, video: 1, link: 2 };
    return [...resources].sort((a, b) =>
      (rank[a.resource_type] ?? 9) - (rank[b.resource_type] ?? 9));
  }, [resources]);

  return (
    <div className="space-y-5">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to labs
      </button>

      {/* Lab header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
            <FlaskConical size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">{lab.title}</h2>
            <div className="flex flex-wrap gap-4 mt-1 text-sm font-medium text-slate-400">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} /> {lab.subject_name || 'General'}
              </span>
              {lab.created_by_name && (
                <span className="flex items-center gap-1.5">
                  <User size={14} /> {lab.created_by_name}
                </span>
              )}
            </div>
          </div>
        </div>
        {lab.description && (
          <p className="text-sm text-slate-600 leading-relaxed mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-wrap">
            {lab.description}
          </p>
        )}
      </div>

      {/* Resources */}
      {ordered.length === 0 ? (
        <div className="bg-white p-14 rounded-3xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-medium italic">This lab has no resources yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map(r => {
            const meta = resMeta(r.resource_type);
            const Icon = meta.icon;
            return (
              <div key={r.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color}`}>
                      {meta.label}
                    </span>
                    {r.resource_type === 'live' && r.scheduled_at && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <Clock size={11} /> {fmtDateTime(r.scheduled_at)}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-slate-800 truncate mt-0.5">{r.title}</p>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all ${
                    r.resource_type === 'live'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : r.resource_type === 'video'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                  }`}>
                  {r.resource_type === 'live' ? 'Join' : r.resource_type === 'video' ? 'Watch' : 'Open'}
                  <ExternalLink size={14} />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function ResourceTag({ type, count }) {
  const meta = resMeta(type);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
      <Icon size={11} /> {count} {meta.label}{count !== 1 ? 's' : ''}
    </span>
  );
}