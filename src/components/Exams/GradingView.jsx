import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import { ArrowLeft, Loader2, Save, CheckCircle2, XCircle } from 'lucide-react';

// =====================================================================
//  GradingView — load one attempt + its answers, allow teacher to
//  award marks per question, write overall feedback, then submit.
// =====================================================================

export default function GradingView({ attemptId, examTitle, totalMarks, onBack }) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [items, setItems]     = useState([]);
  const [grades, setGrades]   = useState({});
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}`);
        const data = await res.json();
        if (cancel) return;
        setAttempt(data.attempt);
        setItems(data.items || []);
        const seed = {};
        (data.items || []).forEach(it => {
          seed[it.question_id] = (it.marks_awarded ?? '').toString();
        });
        setGrades(seed);
        setFeedback(data.attempt?.teacher_feedback || '');
      } catch (e) { console.error(e); }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [attemptId]);

  const setMark = (qid, value) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    setGrades(prev => ({ ...prev, [qid]: value }));
  };

  const totalAwarded = Object.values(grades).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const handleSubmit = async () => {
    if (!window.confirm(`Submit grade ${totalAwarded.toFixed(2)} / ${totalMarks}?`)) return;
    setSaving(true);
    try {
      const body = {
        graded_answers: items.map(it => ({
          question_id: it.question_id,
          marks_awarded: parseFloat(grades[it.question_id]) || 0
        })),
        teacher_feedback: feedback.trim() || null,
        graded_by: user.id
      };
      const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Grading failed');
      alert(`Saved · final score ${data.final_score} / ${totalMarks}`);
      onBack();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }

  if (!attempt) return null;

  return (
    <div className="space-y-5">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to submissions
      </button>

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Grading</p>
          <h2 className="text-xl font-black text-slate-800 mt-1">{examTitle}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Student: <span className="font-bold text-slate-700">{attempt.student_name}</span>
            {attempt.roll_no && <span className="text-slate-400"> · Roll {attempt.roll_no}</span>}
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-5 py-3 rounded-2xl text-center">
          <div className="text-3xl font-black">{totalAwarded.toFixed(2)}</div>
          <div className="text-[10px] font-black uppercase tracking-widest opacity-70">out of {totalMarks}</div>
        </div>
      </div>

      {/* Question-by-question grading */}
      <div className="space-y-4">
        {items.map((it, idx) => {
          const isMCQ = it.question_type === 'multiple_choice';
          const isCorrect = isMCQ && it.answer_text === it.correct_answer;
          return (
            <div key={it.question_id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Question {idx + 1} · Max {it.marks} marks · {isMCQ ? 'MCQ' : 'Written'}
                    </p>
                    <p className="font-bold text-slate-800 mt-1">{it.question_text}</p>
                  </div>
                  {isMCQ && (
                    isCorrect
                      ? <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1"><CheckCircle2 size={12} /> Correct</span>
                      : <span className="text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-700 px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1"><XCircle size={12} /> Wrong</span>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-3 bg-slate-50/30">
                {/* Student answer */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Student's Answer</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-slate-700">
                    {isMCQ && it.options && it.answer_text
                      ? `${it.answer_text} · ${it.options[it.answer_text] || '—'}`
                      : (it.answer_text || <span className="italic text-slate-400">Not answered</span>)}
                  </div>
                </div>

                {/* Correct answer (MCQ only) */}
                {isMCQ && it.correct_answer && it.options && (
                  <div>
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">Correct Answer</p>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800">
                      {it.correct_answer} · {it.options[it.correct_answer]}
                    </div>
                  </div>
                )}

                {/* Marks input */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Award Marks (max {it.marks})
                  </label>
                  <input type="text" inputMode="decimal"
                    value={grades[it.question_id] ?? ''}
                    onChange={e => setMark(it.question_id, e.target.value)}
                    placeholder={`0 – ${it.marks}`}
                    className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall feedback */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-2">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
          Overall Feedback (optional)
        </label>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
          placeholder="Write feedback the student will see…"
          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/10" />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button onClick={onBack} disabled={saving}
          className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-100">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Submit Grades'}
        </button>
      </div>
    </div>
  );
}