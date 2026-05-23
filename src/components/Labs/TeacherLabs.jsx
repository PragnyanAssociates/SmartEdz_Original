import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Search, Loader2, FlaskConical,
  Video, LinkIcon, Radio, ExternalLink
} from 'lucide-react';

// =====================================================================
//  TeacherLabs — create / edit / delete digital labs.
//  Each lab targets one class and bundles many resources:
//    video  → a video URL (YouTube etc.)
//    link   → a generic web link / document
//    live   → a live-class link (Zoom / Meet) with optional schedule
// =====================================================================

const RES_TYPES = [
  { value: 'video', label: 'Video',       icon: Video },
  { value: 'link',  label: 'Link',        icon: LinkIcon },
  { value: 'live',  label: 'Live Class',  icon: Radio }
];

const resTypeMeta = (t) => RES_TYPES.find(r => r.value === t) || RES_TYPES[1];

const isoLocal = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '';
  // for <input type="datetime-local">
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TeacherLabs({ canManage = true }) {
  const { user } = useAuth();

  const [labs, setLabs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');

  // class + subject options for the modal
  const [classes, setClasses]       = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [subjectClasses, setSC]     = useState({});

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const emptyForm = { title: '', description: '', class_id: '', subject_id: '' };
  const [form, setForm]         = useState(emptyForm);
  const [resources, setResources] = useState([]);

  // --- Load labs -------------------------------------------------
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/teacher/${user.id}`);
      const d = await res.json();
      setLabs(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // --- Load classes + subjects -----------------------------------
  const loadFormData = useCallback(async () => {
    if (!user?.institutionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`);
      const d = await res.json();
      setClasses(d.classes || []);
      setSubjects(d.subjects || []);
      setSC(d.subjectClasses || {});
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { loadFormData(); }, [loadFormData]);

  // Subjects available for the chosen class (subject with no link = all)
  const subjectsForClass = useMemo(() => {
    if (!form.class_id) return subjects;
    const cid = parseInt(form.class_id, 10);
    return subjects.filter(s => {
      const links = subjectClasses[s.id];
      if (!links || links.length === 0) return true;
      return links.includes(cid);
    });
  }, [subjects, subjectClasses, form.class_id]);

  const filtered = useMemo(() => {
    if (!query.trim()) return labs;
    const q = query.toLowerCase();
    return labs.filter(l =>
      (l.title || '').toLowerCase().includes(q) ||
      (l.class_group || '').toLowerCase().includes(q) ||
      (l.subject_name || '').toLowerCase().includes(q));
  }, [labs, query]);

  const classLabel = (c) => `${c.className}${c.section ? ' - ' + c.section : ''}`;

  // --- Modal helpers ---------------------------------------------
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setResources([]);
    setModalOpen(true);
  };

  const openEdit = async (lab) => {
    setEditing(lab);
    setForm({
      title: lab.title || '',
      description: lab.description || '',
      class_id: lab.class_id ? String(lab.class_id) : '',
      subject_id: lab.subject_id ? String(lab.subject_id) : ''
    });
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/${lab.id}`);
      const full = await res.json();
      setResources((full.resources || []).map(r => ({
        resource_type: r.resource_type,
        title: r.title,
        url: r.url,
        scheduled_at: isoLocal(r.scheduled_at)
      })));
    } catch { setResources([]); }
    setModalOpen(true);
  };

  // --- Resource list editing -------------------------------------
  const addResource = (type) =>
    setResources(p => [...p, { resource_type: type, title: '', url: '', scheduled_at: '' }]);
  const updateResource = (i, key, val) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const removeResource = (i) =>
    setResources(p => p.filter((_, idx) => idx !== i));

  // --- Save ------------------------------------------------------
  const handleSave = async () => {
    if (!form.title.trim() || !form.class_id) {
      return alert('Title and Class are required.');
    }
    for (const r of resources) {
      if (!r.title.trim() || !r.url.trim()) {
        return alert('Every resource needs both a title and a URL.');
      }
    }
    setSaving(true);
    try {
      const payload = {
        institutionId: user.institutionId,
        title: form.title.trim(),
        description: form.description,
        class_id: parseInt(form.class_id, 10),
        subject_id: form.subject_id ? parseInt(form.subject_id, 10) : null,
        created_by: user.id,
        resources: resources.map(r => ({
          resource_type: r.resource_type,
          title: r.title.trim(),
          url: r.url.trim(),
          scheduled_at: r.resource_type === 'live' && r.scheduled_at
            ? r.scheduled_at.replace('T', ' ') + ':00'
            : null
        }))
      };
      const url = editing
        ? `${API_BASE_URL}/admin/labs/${editing.id}`
        : `${API_BASE_URL}/admin/labs`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setModalOpen(false);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (lab) => {
    if (!window.confirm(`Delete lab "${lab.title}"? All its resources will be removed.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/labs/${lab.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      load();
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FlaskConical className="text-blue-600" size={28} />
          Digital Labs
        </h2>
        <p className="text-slate-500 font-medium mt-1">
          Post videos, links and live classes for your students.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search labs…"
            className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 w-full sm:w-72" />
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Plus size={18} /> Create Lab
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No digital labs yet.</p>
          {canManage && <p className="text-slate-400 text-sm mt-1">Click "Create Lab" to begin.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lab => (
            <div key={lab.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                  <FlaskConical size={20} />
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(lab)}
                      className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit size={15} />
                    </button>
                    <button onClick={() => handleDelete(lab)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-black text-slate-800 mt-3">{lab.title}</h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                {lab.class_group}{lab.subject_name ? ` · ${lab.subject_name}` : ''}
              </p>
              {lab.description && (
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{lab.description}</p>
              )}
              <div className="mt-auto pt-4">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                  {lab.resource_count} resource{lab.resource_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- CREATE / EDIT MODAL ---- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setModalOpen(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-800">
              {editing ? 'Edit Lab' : 'Create Digital Lab'}
            </h2>

            <div className="space-y-5">
              <Field label="Lab Title" required value={form.title}
                onChange={v => setForm({ ...form, title: v })}
                placeholder="e.g. Optics — Reflection & Refraction" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Class" type="select" required value={form.class_id}
                  onChange={v => setForm({ ...form, class_id: v, subject_id: '' })}
                  options={[
                    { value: '', label: 'Select a class' },
                    ...classes.map(c => ({ value: String(c.id), label: classLabel(c) }))
                  ]} />
                <Field label="Subject" type="select" value={form.subject_id}
                  onChange={v => setForm({ ...form, subject_id: v })}
                  options={[
                    { value: '', label: form.class_id ? 'Select a subject' : 'Select a class first' },
                    ...subjectsForClass.map(s => ({ value: String(s.id), label: s.name }))
                  ]} />
              </div>

              <Field label="Description" type="textarea" value={form.description}
                onChange={v => setForm({ ...form, description: v })}
                placeholder="What this lab covers…" />

              {/* Resources */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Resources
                  </label>
                  <span className="text-[11px] font-bold text-slate-400">{resources.length} added</span>
                </div>

                <div className="space-y-3">
                  {resources.map((r, i) => {
                    const meta = resTypeMeta(r.resource_type);
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-blue-600 border border-slate-200">
                            <Icon size={14} />
                          </div>
                          <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                            {meta.label}
                          </span>
                          <button onClick={() => removeResource(i)}
                            className="ml-auto p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <input value={r.title}
                            onChange={e => updateResource(i, 'title', e.target.value)}
                            placeholder="Resource title"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                          <input value={r.url}
                            onChange={e => updateResource(i, 'url', e.target.value)}
                            placeholder={r.resource_type === 'video'
                              ? 'Video URL (YouTube etc.)'
                              : r.resource_type === 'live'
                                ? 'Live class link (Zoom / Meet)'
                                : 'Web link / document URL'}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" />
                          {r.resource_type === 'live' && (
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Scheduled time (optional)
                              </label>
                              <input type="datetime-local" value={r.scheduled_at}
                                onChange={e => updateResource(i, 'scheduled_at', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 mt-1" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add-resource buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {RES_TYPES.map(rt => {
                    const Icon = rt.icon;
                    return (
                      <button key={rt.value} onClick={() => addResource(rt.value)}
                        className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all">
                        <Plus size={13} /> <Icon size={13} /> {rt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-slate-900 hover:bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Lab')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', options, required, placeholder }) {
  const base = "w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/10 text-sm";
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select' ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className={base + ' cursor-pointer'}>
          {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder} className={base + ' resize-none'} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={base} />
      )}
    </div>
  );
}