import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  Loader2, Play, ArrowLeft, ArrowRight, HelpCircle, CheckCircle2,
  Clock, ChevronRight, Send, BookOpen, AlertTriangle
} from 'lucide-react';

// =====================================================================
//  StudentExamsView — list of exams a student can attempt
//  Views: list | taking | result
// =====================================================================

export default function StudentExamsView() {
  const [view, setView] = useState('list');
  const [picked, setPicked] = useState(null);     // {exam_id, attempt_id, ...}

  if (view === 'taking' && picked) {
    return <TakeExamView exam={picked} onFinish={() => setView('list')} />;
  }
  if (view === 'result' && picked) {
    return <ResultView attemptId={picked.attempt_id} onBack={() => setView('list')} />;
  }
  return <ExamList onTake={(e) => { setPicked(e); setView('taking'); }}
                   onResult={(e) => { setPicked(e); setView('result'); }} />;
}


// =====================================================================
//  List
// =====================================================================
function ExamList({ onTake, onResult }) {
  const { user } = useAuth();
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams/student/${user.id}`);
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }
  if (exams.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">No exams available for you right now.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
          <tr>
            <th className="p-4">Exam</th>
            <th className="p-4">Details</th>
            <th className="p-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {exams.map(e => (
            <tr key={e.exam_id} className="hover:bg-slate-50/50">
              <td className="p-4">
                <div className="font-bold text-slate-700">{e.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {e.className}{e.section ? ` - ${e.section}` : ''}
                  {e.subject_name && ` · ${e.subject_name}`}
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex items-center gap-1">
                    <HelpCircle size={10} /> {e.question_count} Qs
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full inline-flex items-center gap-1">
                    <CheckCircle2 size={10} /> {e.total_marks} Marks
                  </span>
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full inline-flex items-center gap-1">
                    <Clock size={10} /> {e.time_limit_mins > 0 ? `${e.time_limit_mins} min` : 'No limit'}
                  </span>
                </div>
              </td>
              <td className="p-4 text-right">
                <ActionForStatus exam={e} onTake={onTake} onResult={onResult} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionForStatus({ exam, onTake, onResult }) {
  if (exam.attempt_status === 'graded') {
    return (
      <button onClick={() => onResult(exam)}
        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
        View Result <ArrowRight size={12} />
      </button>
    );
  }
  if (exam.attempt_status === 'submitted') {
    return (
      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
        <Clock size={12} /> Awaiting Grade
      </span>
    );
  }
  if (exam.attempt_status === 'in_progress') {
    return (
      <button onClick={() => onTake(exam)}
        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
        <Play size={12} /> Resume
      </button>
    );
  }
  return (
    <button onClick={() => onTake(exam)}
      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
      <Play size={12} /> Start Now
    </button>
  );
}


// =====================================================================
//  Take exam
// =====================================================================
function TakeExamView({ exam, onFinish }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // -----------------------------------------------------------------
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // Start (or resume) the attempt first — protects against double-tap
        const startRes = await fetch(`${API_BASE_URL}/admin/exams/${exam.exam_id}/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: user.id })
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || 'Could not start');
        if (cancel) return;
        setAttemptId(startData.attempt_id);

        if (exam.time_limit_mins > 0) setTimeLeft(exam.time_limit_mins * 60);

        const qRes = await fetch(`${API_BASE_URL}/admin/exams/${exam.exam_id}/take`);
        const qData = await qRes.json();
        if (cancel) return;
        setQuestions(qData || []);
      } catch (e) {
        alert(e.message);
        onFinish();
      }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line
  }, [exam.exam_id, user.id]);

  // -----------------------------------------------------------------
  // Timer
  // -----------------------------------------------------------------
  useEffect(() => {
    if (timeLeft === null || submitting) return;
    if (timeLeft <= 0) { doSubmit(true); return; }
    const t = setInterval(() => setTimeLeft(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [timeLeft, submitting]);

  // -----------------------------------------------------------------
  const setAnswer = (qid, value) => setAnswers(prev => ({ ...prev, [qid]: value }));

  const doSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/attempts/${attemptId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      alert(auto
        ? 'Time up — your exam was submitted automatically.'
        : 'Exam submitted!');
      onFinish();
    } catch (e) {
      alert(e.message);
      setSubmitting(false);
    }
  };

  const handleManualSubmit = () => {
    const unans = questions.length - Object.keys(answers).filter(k => answers[k]).length;
    if (unans > 0 && !window.confirm(`${unans} question(s) are unanswered. Submit anyway?`)) return;
    if (!window.confirm('Submit your exam now? This cannot be undone.')) return;
    doSubmit(false);
  };

  const fmtTime = (s) => {
    if (s == null) return '';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }
  if (questions.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
        <p className="text-slate-400 font-medium">No questions in this exam.</p>
      </div>
    );
  }

  const cq = questions[currentIdx];
  const lowOnTime = timeLeft !== null && timeLeft < 60;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="font-black text-slate-800">{exam.title}</h2>
          <p className="text-xs text-slate-400 font-medium">
            Question {currentIdx + 1} of {questions.length}
          </p>
        </div>
        {timeLeft !== null && (
          <div className={`${lowOnTime ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'} px-4 py-2 rounded-xl inline-flex items-center gap-2`}>
            <Clock size={14} />
            <span className="font-black text-sm tabular-nums">{fmtTime(timeLeft)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Question palette */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 h-fit lg:sticky lg:top-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Questions</h3>
          <div className="grid grid-cols-6 lg:grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const answered = !!answers[q.id];
              const current = i === currentIdx;
              return (
                <button key={q.id} onClick={() => setCurrentIdx(i)}
                  className={`h-10 rounded-lg text-sm font-black transition-all ${
                    current ? 'bg-blue-600 text-white ring-2 ring-blue-300 scale-110'
                      : answered ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button onClick={handleManualSubmit} disabled={submitting}
            className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>

        {/* Question card */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-slate-800 text-lg">{cq.question_text}</p>
              <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full whitespace-nowrap">
                {cq.marks} mark{cq.marks === 1 ? '' : 's'}
              </span>
            </div>

            {cq.question_type === 'multiple_choice' && cq.options ? (
              <div className="space-y-2">
                {Object.entries(cq.options).map(([key, label]) => label.trim() && (
                  <button key={key}
                    onClick={() => setAnswer(cq.id, key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      answers[cq.id] === key
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-slate-100 hover:border-slate-300'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        answers[cq.id] === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>{key}</span>
                      <span className={`text-sm ${answers[cq.id] === key ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                        {label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <textarea value={answers[cq.id] || ''} onChange={e => setAnswer(cq.id, e.target.value)}
                rows={6} placeholder="Type your answer here…"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 resize-none" />
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Previous
            </button>
            <button onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))}
              disabled={currentIdx === questions.length - 1}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2">
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// =====================================================================
//  Result view
// =====================================================================
function ResultView({ attemptId, onBack }) {
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/attempts/${attemptId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>;
  }
  if (!data) return null;

  const { attempt, items } = data;
  const pct = attempt.total_marks > 0 ? (attempt.final_score / attempt.total_marks) * 100 : 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-5">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Back to exams
      </button>

      {/* Score card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col md:flex-row gap-8 items-center">
        <div className="relative w-44 h-44 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" stroke="#E2E8F0" strokeWidth="12" fill="transparent" />
            <circle cx="60" cy="60" r="54" stroke="#2563EB" strokeWidth="12" fill="transparent"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset .8s ease-out' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-blue-600">{pct.toFixed(1)}%</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score</div>
          </div>
        </div>
        <div className="text-center md:text-left">
          <h2 className="font-black text-slate-800 text-2xl">{attempt.exam_title}</h2>
          <p className="text-slate-500 font-medium mt-1">
            Final Score: <span className="font-black text-slate-800">{attempt.final_score}</span> / {attempt.total_marks}
          </p>
          {attempt.teacher_feedback && (
            <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-xl text-sm text-blue-800 italic">
              "{attempt.teacher_feedback}"
              {attempt.graded_by_name && (
                <div className="not-italic text-xs text-blue-500 font-bold mt-1.5">— {attempt.graded_by_name}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question review */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-black text-slate-800 mb-4">Detailed Review</h3>
        <div className="space-y-2">
          {items.map((it, idx) => {
            const isCorrect = (it.marks_awarded ?? 0) === it.marks;
            const some = (it.marks_awarded ?? 0) > 0 && !isCorrect;
            return (
              <div key={it.question_id} className="border border-slate-100 rounded-2xl overflow-hidden">
                <button onClick={() => setOpenId(openId === it.question_id ? null : it.question_id)}
                  className="w-full p-4 flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100">
                  <span className="text-sm font-bold text-slate-700 text-left">{idx + 1}. {it.question_text}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      isCorrect ? 'bg-emerald-100 text-emerald-700'
                        : some ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {it.marks_awarded ?? 0} / {it.marks}
                    </span>
                    <ChevronRight size={14} className={`text-slate-400 transition-transform ${openId === it.question_id ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {openId === it.question_id && (
                  <div className="p-4 bg-white border-t border-slate-100 space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Answer</p>
                      <div className="bg-blue-50 rounded-xl p-3">
                        {it.question_type === 'multiple_choice' && it.options && it.answer_text
                          ? `${it.answer_text} · ${it.options[it.answer_text] || '—'}`
                          : (it.answer_text || <span className="italic text-slate-400">Not answered</span>)}
                      </div>
                    </div>
                    {it.question_type === 'multiple_choice' && it.correct_answer && it.options && (
                      <div>
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Correct Answer</p>
                        <div className="bg-emerald-50 rounded-xl p-3 text-emerald-800">
                          {it.correct_answer} · {it.options[it.correct_answer]}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}