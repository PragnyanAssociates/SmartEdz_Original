import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Eye, Loader2, ArrowLeft, CalendarDays,
  Clock, MapPin, AlertTriangle, Star
} from 'lucide-react';

// =====================================================================
//  SchedulesManager — full CRUD for Exam Schedules
//
//  An "Internal" schedule has rows: { date, subject, time, room }
//  An "External" (Govt) schedule has rows: { examName, fromDate, toDate }
//  A "special" row breaks the table with a banner: { type, mainText, subText }
// =====================================================================

const emptyInternalRow = () => ({ date: '', subject: '', time_from: '09:00', time_to: '12:00', room: '' });
const emptyExternalRow = () => ({ examName: '', fromDate: '', toDate: '' });
const emptySpecialRow  = () => ({ type: 'special', mainText: '', subText: '' });

const fmtDDMMYYYY = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export default function SchedulesManager({ canManage }) {
  const { user } = useAuth();

  // ------------ data state ----------------
  const [schedules, setSchedules] = useState([]);
  const [classes, setClasses]     = useState([]);
  const [loading, setLoading]     = useState(true);

  // ------------ view state ----------------
  const [view, setView] = useState('list');   // 'list' | 'detail'
  const [selected, setSelected] = useState(null);

  // ------------ filters -------------------
  const [activeTab, setActiveTab] = useState('Internal');
  const [filterClass, setFilterClass] = useState('all');

  // ------------ modal state ---------------
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({
    title: '', subtitle: '', exam_type: 'Internal',
    class_id: '', section: '',
    rows: [emptyInternalRow()]
  });

  // -----------------------------------------------------------------
  // Load
  // -----------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, dataRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/exam-schedules/${user.institutionId}`),
        fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`)
      ]);
      const schedData = await schedRes.json();
      const aggData   = await dataRes.json();
      setSchedules(Array.isArray(schedData) ? schedData : []);
      setClasses(aggData.classes || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return schedules.filter(s => {
      if (s.exam_type !== activeTab) return false;
      if (filterClass === 'all') return true;
      if (filterClass === 'none' && s.class_id == null) return true;
      return String(s.class_id) === String(filterClass);
    });
  }, [schedules, activeTab, filterClass]);

  // -----------------------------------------------------------------
  // Modal helpers
  // -----------------------------------------------------------------
  const openAdd = () => {
    setEditing(null);
    setForm({
      title: '', subtitle: '', exam_type: 'Internal',
      class_id: '', section: '',
      rows: [emptyInternalRow()]
    });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    // Migrate stored shape into editor shape (split time string)
    const rows = (s.schedule_data || []).map(r => {
      if (r.type === 'special') return { ...r };
      if (s.exam_type === 'External') return { ...r };
      // Internal — split "09:00 - 12:00" into separate fields
      const [from = '', to = ''] = (r.time || '').split(' - ').map(x => x.trim());
      return {
        date: r.date || '',
        subject: r.subject || '',
        time_from: timeTo24(from),
        time_to:   timeTo24(to),
        room: r.room || r.block || ''
      };
    });
    setForm({
      title: s.title || '',
      subtitle: s.subtitle || '',
      exam_type: s.exam_type || 'Internal',
      class_id: s.class_id ? String(s.class_id) : '',
      section: s.section || '',
      rows: rows.length ? rows : [s.exam_type === 'External' ? emptyExternalRow() : emptyInternalRow()]
    });
    setShowModal(true);
  };

  const handleTypeChange = (newType) => {
    setForm(f => ({
      ...f,
      exam_type: newType,
      rows: [newType === 'External' ? emptyExternalRow() : emptyInternalRow()]
    }));
  };

  const addRow = (special = false) => {
    setForm(f => ({
      ...f,
      rows: [...f.rows, special ? emptySpecialRow()
                        : (f.exam_type === 'External' ? emptyExternalRow() : emptyInternalRow())]
    }));
  };

  const removeRow = (idx) => {
    setForm(f => ({ ...f, rows: f.rows.filter((_, i) => i !== idx) }));
  };

  const updateRow = (idx, field, value) => {
    setForm(f => ({
      ...f,
      rows: f.rows.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    }));
  };

  // -----------------------------------------------------------------
  // Save / Delete
  // -----------------------------------------------------------------
  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required.');
    if (form.rows.length === 0) return alert('Add at least one row.');

    setSaving(true);
    try {
      // Convert editor rows → stored shape
      const payloadRows = form.rows.map(r => {
        if (r.type === 'special') return { type: 'special', mainText: r.mainText, subText: r.subText };
        if (form.exam_type === 'External') {
          return {
            examName: r.examName,
            fromDate: fmtDDMMYYYY(r.fromDate),
            toDate:   fmtDDMMYYYY(r.toDate)
          };
        }
        return {
          date: fmtDDMMYYYY(r.date),
          subject: r.subject,
          time: `${time12(r.time_from)} - ${time12(r.time_to)}`,
          room: r.room
        };
      });

      const body = {
        institutionId: user.institutionId,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        exam_type: form.exam_type,
        class_id: form.class_id ? parseInt(form.class_id, 10) : null,
        section: form.section.trim() || null,
        schedule_data: payloadRows,
        created_by: user.id
      };

      const url = editing
        ? `${API_BASE_URL}/admin/exam-schedules/${editing.id}`
        : `${API_BASE_URL}/admin/exam-schedules`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.title}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exam-schedules/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (view === 'detail' && selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('list')}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
          <ArrowLeft size={14} /> Back to schedules
        </button>
        <ScheduleDetailView schedule={selected} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1 self-start">
          {['Internal', 'External'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'Internal' ? 'School Exams' : 'Govt Schedule'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer shadow-sm">
            <option value="all">All classes</option>
            <option value="none">— All-school —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.className}{c.section ? ` - ${c.section}` : ''}
              </option>
            ))}
          </select>
          {canManage && (
            <button onClick={openAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
              <Plus size={16} /> Create Schedule
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No {activeTab.toLowerCase()} schedules yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">Class</th>
                <th className="p-4">Created By</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{s.title}</div>
                    {s.subtitle && <div className="text-xs text-slate-400">{s.subtitle}</div>}
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600">
                    {s.className ? `${s.className}${s.section ? ` - ${s.section}` : ''}` : <span className="italic text-slate-400">All classes</span>}
                  </td>
                  <td className="p-4 text-sm text-slate-500">{s.created_by_name || '—'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setSelected(s); setView('detail'); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                        <Eye size={15} />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(s)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => handleDelete(s)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800">
                {editing ? 'Edit Schedule' : 'Create Schedule'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Top form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Title" required>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Final Term Exam" className={inputCls} />
                </FormField>
                <FormField label="Subtitle">
                  <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                    placeholder="e.g. 2025-2026" className={inputCls} />
                </FormField>
                <FormField label="Schedule Type">
                  <select value={form.exam_type} onChange={e => handleTypeChange(e.target.value)}
                    className={inputCls}>
                    <option value="Internal">School Exam</option>
                    <option value="External">Govt Schedule</option>
                  </select>
                </FormField>
                <FormField label="Class">
                  <select value={form.class_id}
                    onChange={e => setForm({ ...form, class_id: e.target.value })}
                    className={inputCls}>
                    <option value="">All classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.className}{c.section ? ` - ${c.section}` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Section (optional)">
                  <input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}
                    placeholder="Leave blank for all sections" className={inputCls} />
                </FormField>
              </div>

              {/* Row editor */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-slate-700 text-sm">Schedule Rows</h3>
                  <div className="flex gap-2">
                    <button onClick={() => addRow(false)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Plus size={12} /> Add Row
                    </button>
                    <button onClick={() => addRow(true)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Star size={12} /> Special Row
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {form.rows.map((r, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 relative">
                      <button onClick={() => removeRow(i)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-red-500" title="Remove">
                        <X size={14} />
                      </button>
                      {r.type === 'special' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                          <FormField label="Main text">
                            <input value={r.mainText} onChange={e => updateRow(i, 'mainText', e.target.value)}
                              placeholder="e.g. Holiday" className={inputCls} />
                          </FormField>
                          <FormField label="Sub text">
                            <input value={r.subText} onChange={e => updateRow(i, 'subText', e.target.value)}
                              placeholder="Optional" className={inputCls} />
                          </FormField>
                        </div>
                      ) : form.exam_type === 'External' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-6">
                          <FormField label="Exam Name">
                            <input value={r.examName} onChange={e => updateRow(i, 'examName', e.target.value)}
                              placeholder="e.g. FA-1" className={inputCls} />
                          </FormField>
                          <FormField label="From">
                            <input type="date" value={r.fromDate}
                              onChange={e => updateRow(i, 'fromDate', e.target.value)} className={inputCls} />
                          </FormField>
                          <FormField label="To">
                            <input type="date" value={r.toDate}
                              onChange={e => updateRow(i, 'toDate', e.target.value)} className={inputCls} />
                          </FormField>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-6">
                          <FormField label="Date">
                            <input type="date" value={r.date}
                              onChange={e => updateRow(i, 'date', e.target.value)} className={inputCls} />
                          </FormField>
                          <FormField label="Subject">
                            <input value={r.subject} onChange={e => updateRow(i, 'subject', e.target.value)}
                              placeholder="Maths" className={inputCls} />
                          </FormField>
                          <FormField label="Time">
                            <div className="flex gap-1">
                              <input type="time" value={r.time_from}
                                onChange={e => updateRow(i, 'time_from', e.target.value)} className={inputCls + ' px-1'} />
                              <input type="time" value={r.time_to}
                                onChange={e => updateRow(i, 'time_to', e.target.value)} className={inputCls + ' px-1'} />
                            </div>
                          </FormField>
                          <FormField label="Room">
                            <input value={r.room} onChange={e => updateRow(i, 'room', e.target.value)}
                              placeholder="e.g. 5" className={inputCls} />
                          </FormField>
                        </div>
                      )}
                    </div>
                  ))}
                  {form.rows.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 italic">
                      Empty schedule — add a row.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-100">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================================
//  ScheduleDetailView — read-only printable view of one schedule
//  Also used by StudentSchedulesView
// =====================================================================
export function ScheduleDetailView({ schedule }) {
  const isExternal = schedule.exam_type === 'External';
  const rows = schedule.schedule_data || [];

  const dates = useMemo(() => {
    const real = rows.filter(r => r.type !== 'special');
    if (real.length === 0) return { start: null, end: null };
    if (isExternal) return { start: real[0].fromDate, end: real[real.length - 1].toDate };
    return { start: real[0].date, end: real[real.length - 1].date };
  }, [rows, isExternal]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 items-center justify-center mb-3 shadow">
          <CalendarDays className="text-white" size={22} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">{schedule.title}</h2>
        <div className="mt-2 inline-block">
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
            isExternal ? 'bg-purple-50 text-purple-600' : 'bg-red-50 text-red-600'
          }`}>
            {isExternal ? 'Govt Schedule' : 'School Exam'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-500">
          {schedule.className && (
            <span>{schedule.className}{schedule.section ? ` - ${schedule.section}` : ''}</span>
          )}
          {schedule.subtitle && <span>{schedule.subtitle}</span>}
          {dates.start && (
            <>
              <span>Start: <span className="font-bold text-blue-600">{dates.start}</span></span>
              {dates.end && dates.end !== dates.start && (
                <span>End: <span className="font-bold text-blue-600">{dates.end}</span></span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              {isExternal ? (
                <>
                  <th className="p-4">Exam Name</th>
                  <th className="p-4">From</th>
                  <th className="p-4">To</th>
                </>
              ) : (
                <>
                  <th className="p-4">Date</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Room</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 && (
              <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic">Empty schedule</td></tr>
            )}
            {rows.map((r, i) => {
              if (r.type === 'special') {
                return (
                  <tr key={i} className="bg-blue-50/40">
                    <td colSpan={isExternal ? 3 : 4} className="p-4 text-center">
                      <span className="font-black text-blue-700 block">{r.mainText}</span>
                      {r.subText && <span className="text-xs italic text-blue-500">{r.subText}</span>}
                    </td>
                  </tr>
                );
              }
              if (isExternal) {
                return (
                  <tr key={i} className="even:bg-slate-50/30">
                    <td className="p-4 font-bold text-slate-800">{r.examName}</td>
                    <td className="p-4 text-indigo-700">{r.fromDate || '—'}</td>
                    <td className="p-4 text-indigo-700">{r.toDate || '—'}</td>
                  </tr>
                );
              }
              return (
                <tr key={i} className="even:bg-slate-50/30">
                  <td className="p-4 font-bold text-indigo-700">{r.date}</td>
                  <td className="p-4 text-slate-800 font-medium">{r.subject}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
                      <Clock size={12} className="mr-1.5" /> {r.time}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
                      <MapPin size={12} className="mr-1.5" /> Room {r.room || r.block || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10';

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function timeTo24(t) {
  if (!t) return '';
  // "09:30 AM" → "09:30"
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const mod = m[3] || '';
  if (mod.toUpperCase() === 'PM' && h < 12) h += 12;
  if (mod.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function time12(t24) {
  if (!t24) return '';
  const [h24, min] = t24.split(':');
  let h = parseInt(h24, 10);
  const mod = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${min} ${mod}`;
}