import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  BarChart3, CalendarCheck, CalendarX, Clock,
  CheckCircle2, XCircle, Loader2, Calendar as CalIcon
} from 'lucide-react';

// =====================================================================
//  AttendanceHistory
//  Shows: summary cards + a list of daily entries with marker/editor info.
//  Filters: Daily | Monthly | Yearly | Custom range.
// =====================================================================

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const fmtDateTime = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const STATUS_META = {
  P: { label: 'Present', text: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
  A: { label: 'Absent',  text: 'text-red-600',     bg: 'bg-red-50',     icon: XCircle },
  L: { label: 'Late',    text: 'text-amber-600',   bg: 'bg-amber-50',   icon: Clock }
};

export default function AttendanceHistory({ userId, userName, selfOnly = false }) {
  const { user: me } = useAuth();
  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, setYear]   = useState(() => new Date().getFullYear());
  const [from, setFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  const [rows, setRows]       = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // -----------------------------------------------------------------
  // Resolve range based on mode
  // -----------------------------------------------------------------
  const resolveRange = () => {
    if (mode === 'daily') return { from: day, to: day };
    if (mode === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
    }
    if (mode === 'yearly') return { from: `${year}-01-01`, to: `${year}-12-31` };
    return { from, to };
  };

  // -----------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = resolveRange();
      const url = `${API_BASE_URL}/admin/attendance/history/${userId}?from=${r.from}&to=${r.to}`;
      const res = await fetch(url);
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (e) { console.error(e); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, day, month, year, from, to]);

  useEffect(() => { load(); }, [load]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <div className="space-y-5">
      {selfOnly && (
        <div className="text-center">
          <h2 className="text-lg font-black text-slate-800">{userName || me?.name}</h2>
          <p className="text-xs text-slate-400 font-medium">Your attendance record</p>
        </div>
      )}
      {!selfOnly && userName && (
        <div className="text-center">
          <h2 className="text-lg font-black text-slate-800">{userName}</h2>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          {['daily', 'monthly', 'yearly', 'custom'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Range pickers */}
      <div className="flex justify-center">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-3 inline-flex flex-wrap items-center gap-3">
          <CalIcon size={14} className="text-slate-400 ml-2" />
          {mode === 'daily' && (
            <input type="date" value={day} onChange={e => setDay(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
          )}
          {mode === 'monthly' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
          )}
          {mode === 'yearly' && (
            <input type="number" min="2000" max="2099" value={year}
              onChange={e => setYear(parseInt(e.target.value, 10) || year)}
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm w-24 outline-none focus:ring-2 focus:ring-blue-500/10" />
          )}
          {mode === 'custom' && (
            <>
              <span className="text-xs font-bold text-slate-400 uppercase">From</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
              <span className="text-xs font-bold text-slate-400 uppercase">To</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SumCard icon={BarChart3}      label="Attendance %" value={`${summary.percentage}%`} color="blue" />
          <SumCard icon={CalendarCheck}  label="Present"      value={summary.present} color="emerald" />
          <SumCard icon={CalendarX}      label="Absent"       value={summary.absent}  color="red" />
          <SumCard icon={Clock}          label="Late"         value={summary.late}    color="amber" />
        </div>
      )}

      {/* Daily mode → single big card */}
      {mode === 'daily' && !loading && (
        <DailyBigCard row={rows[0]} date={day} />
      )}

      {/* List */}
      {mode !== 'daily' && (
        loading ? (
          <div className="text-center py-16">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-medium">No attendance records in this range.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm divide-y divide-slate-50">
            {rows.map(r => <HistoryRow key={r.id} row={r} />)}
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------
function SumCard({ icon: Icon, label, value, color }) {
  const map = {
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-600',
    amber:   'bg-amber-50 text-amber-600'
  };
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <div className={`w-11 h-11 rounded-xl ${map[color]} flex items-center justify-center mb-3`}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

function HistoryRow({ row }) {
  const meta = STATUS_META[row.status] || { label: 'Unknown', text: 'text-slate-500', bg: 'bg-slate-50', icon: Clock };
  const Icon = meta.icon;
  return (
    <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className={`${meta.bg} ${meta.text} w-10 h-10 rounded-xl flex items-center justify-center`}>
            <Icon size={18} />
          </div>
          <div>
            <div className="font-black text-slate-800">{fmtDate(row.attendance_date)}</div>
            <div className={`text-xs font-bold uppercase tracking-widest ${meta.text}`}>{meta.label}</div>
          </div>
        </div>
      </div>
      <div className="text-xs text-slate-500 space-y-0.5 text-left sm:text-right">
        {row.marked_by_name && (
          <div>
            <span className="text-slate-400">Marked by</span>{' '}
            <span className="font-bold text-slate-700">{row.marked_by_name}</span>{' '}
            <span className="text-slate-400">({row.marked_by_role}) · {fmtDateTime(row.marked_at)}</span>
          </div>
        )}
        {row.updated_by_name && (
          <div className="text-amber-600">
            <span className="opacity-70">Updated by</span>{' '}
            <span className="font-bold">{row.updated_by_name}</span>{' '}
            <span className="opacity-70">({row.updated_by_role}) · {fmtDateTime(row.updated_at)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyBigCard({ row, date }) {
  if (!row) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="font-bold text-slate-500">No record for {fmtDate(date)}</p>
      </div>
    );
  }
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  const bigBg = row.status === 'P' ? 'bg-emerald-600' : row.status === 'A' ? 'bg-red-600' : 'bg-amber-500';
  return (
    <div className={`${bigBg} rounded-3xl p-10 text-white max-w-md mx-auto text-center shadow-xl`}>
      <Icon size={56} className="mx-auto mb-3 opacity-90" />
      <div className="text-3xl font-black uppercase tracking-widest">{meta.label}</div>
      <div className="text-sm opacity-90 mt-2">{fmtDate(row.attendance_date)}</div>
      <div className="mt-5 inline-block bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-xs font-bold">
        Marked by {row.marked_by_name} ({row.marked_by_role})
      </div>
      {row.updated_by_name && (
        <div className="mt-2 text-xs opacity-90">
          Updated by {row.updated_by_name} · {fmtDateTime(row.updated_at)}
        </div>
      )}
    </div>
  );
}