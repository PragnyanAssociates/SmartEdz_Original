import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Plus, Edit, Trash2, X, Eye, Loader2, ArrowLeft, FileText,
  Save, BookOpen, HelpCircle, CheckCircle2, Clock
} from 'lucide-react';
import ExamEditor from './ExamEditor';
import GradingView from './GradingView';

// =====================================================================
//  ExamsManager — teacher / admin side
//
//  Views: list → create | edit | submissions | grade
// =====================================================================

export default function ExamsManager({ canManage }) {
  const { user } = useAuth();
  const [view, setView] = useState('list');     // list | create | submissions | grade
  const [editingExam, setEditingExam] = useState(null);
  const [pickedExam, setPickedExam]   = useState(null);
  const [pickedSubmission, setPickedSubmission] = useState(null);

  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);

  // -----------------------------------------------------------------
  const loadExams = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams/teacher/${user.id}`);
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (view === 'list') loadExams(); }, [view, loadExams]);

  // -----------------------------------------------------------------
  const handleDelete = async (exam) => {
    if (!window.confirm(`Delete "${exam.title}"? All submissions will be lost.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams/${exam.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadExams();
    } catch (e) { alert(e.message); }
  };

  // ---- Sub-views ---------------------------------------------------
  if (view === 'create') {
    return (
      <ExamEditor
        examToEdit={editingExam}
        onFinish={() => { setEditingExam(null); setView('list'); }}
      />
    );
  }

  if (view === 'submissions' && pickedExam) {
    return (
      <SubmissionsView
        exam={pickedExam}
        onBack={() => setView('list')}
        onGrade={(sub) => { setPickedSubmission(sub); setView('grade'); }}
      />
    );
  }

  if (view === 'grade' && pickedSubmission && pickedExam) {
    return (
      <GradingView
        attemptId={pickedSubmission.attempt_id}
        examTitle={pickedExam.title}
        totalMarks={pickedExam.total_marks}
        onBack={() => setView('submissions')}
      />
    );
  }

  // ---- List view ---------------------------------------------------
  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex justify-end">
          <button onClick={() => { setEditingExam(null); setView('create'); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
            <Plus size={16} /> Create Online Exam
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
      ) : exams.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No exams created yet.</p>
          {canManage && <p className="text-xs text-slate-400 mt-2">Click "Create Online Exam" to start.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4">Exam</th>
                <th className="p-4">Class · Subject</th>
                <th className="p-4">Details</th>
                <th className="p-4">Submissions</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {exams.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{e.title}</div>
                    <div className="text-xs text-slate-400">by {e.created_by_name || '—'}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    <div className="font-medium">{e.className}{e.section ? ` - ${e.section}` : ''}</div>
                    {e.subject_name && (
                      <div className="text-xs flex items-center gap-1 text-slate-400 mt-0.5">
                        <BookOpen size={11} /> {e.subject_name}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                      <Pill icon={HelpCircle} color="blue" label={`${e.question_count} Qs`} />
                      <Pill icon={CheckCircle2} color="emerald" label={`${e.total_marks} Marks`} />
                      <Pill icon={Clock} color="amber" label={e.time_limit_mins > 0 ? `${e.time_limit_mins} min` : 'No limit'} />
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      e.submission_count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {e.submission_count} submission{e.submission_count === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setPickedExam(e); setView('submissions'); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Submissions">
                        <Eye size={15} />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => { setEditingExam(e); setView('create'); }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => handleDelete(e)}
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
    </div>
  );
}


// =====================================================================
//  SubmissionsView — list of who attempted an exam
// =====================================================================
function SubmissionsView({ exam, onBack, onGrade }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/exams/${exam.id}/submissions`)
      .then(r => r.json())
      .then(d => setSubs(Array.isArray(d) ? d : []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [exam.id]);

  const filtered = subs.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.student_name || '').toLowerCase().includes(q) ||
           (s.roll_no || '').toString().toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to exams
      </button>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h2 className="font-black text-slate-800">{exam.title}</h2>
            <p className="text-xs text-slate-400 font-medium">Student submissions · {exam.total_marks} total marks</p>
          </div>
          <input placeholder="Search name or roll…" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm w-full sm:w-64 outline-none focus:ring-2 focus:ring-blue-500/10" />
        </div>

        {loading ? (
          <div className="p-16 text-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-400 font-medium">No submissions yet.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Status</th>
                <th className="p-4">Score</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.attempt_id} className="hover:bg-slate-50/50">
                  <td className="p-4">
                    <div className="font-bold text-slate-700 text-sm">{s.student_name}</div>
                    <div className="text-xs text-slate-400">
                      {s.roll_no ? `Roll ${s.roll_no}` : (s.username ? `@${s.username}` : '')}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      s.status === 'graded' ? 'bg-emerald-50 text-emerald-700'
                        : s.status === 'submitted' ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>{s.status.replace('_', ' ')}</span>
                  </td>
                  <td className="p-4 font-bold text-slate-700 text-sm">
                    {s.status === 'graded' ? `${s.final_score} / ${exam.total_marks}` : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => onGrade(s)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
                      <Edit size={12} /> {s.status === 'graded' ? 'Update' : 'Grade'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Pill({ icon: Icon, color, label }) {
  const map = {
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700'
  };
  return (
    <span className={`${map[color]} px-2 py-1 rounded-full inline-flex items-center gap-1`}>
      <Icon size={10} /> {label}
    </span>
  );
}