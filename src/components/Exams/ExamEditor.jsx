import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { API_BASE_URL } from '../../apiConfig';
import {
  ArrowLeft, Save, Loader2, Plus, X, AlertTriangle, BookOpen, Info
} from 'lucide-react';

// =====================================================================
//  ExamEditor — create or edit an online exam
//
//  Top-level exam fields: title, description, class, section, subject,
//  time_limit_mins. Then a question editor underneath.
// =====================================================================

const newQuestion = () => ({
  id: Date.now() + Math.random(),
  question_text: '',
  question_type: 'multiple_choice',
  options: { A: '', B: '', C: '', D: '' },
  correct_answer: '',
  marks: 1
});

export default function ExamEditor({ examToEdit, onFinish }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');
  const isEditMode = !!examToEdit;

  const [details, setDetails] = useState({
    title: '', description: '',
    class_id: '', section: '', subject_id: '',
    time_limit_mins: 0, status: 'published'
  });
  const [questions, setQuestions] = useState([newQuestion()]);

  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allTeacherSubjects, setAllTeacherSubjects] = useState([]);  // teacher's own subjects
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // -----------------------------------------------------------------
  // Bootstrap: classes (scoped if teacher), subjects, and (if edit) the exam itself
  // -----------------------------------------------------------------
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [aggRes, classesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/data/${user.institutionId}`),
          isTeacher && !isAllAccess
            ? fetch(`${API_BASE_URL}/admin/attendance/teacher-classes/${user.id}`)
            : Promise.resolve(null)
        ]);
        const agg = await aggRes.json();
        if (cancel) return;
        setSubjects(agg.subjects || []);

        // Teacher's own subjects (so subject dropdown is scoped to what they teach)
        if (isTeacher && !isAllAccess) {
          const mySubs = (agg.teacherSubjects || {})[user.id] || [];
          setAllTeacherSubjects(mySubs);
        }

        // Classes: teacher gets their timetable classes; admin gets all
        if (isTeacher && !isAllAccess && classesRes) {
          const teacherClasses = await classesRes.json();
          setClasses(Array.isArray(teacherClasses) ? teacherClasses : []);
        } else {
          setClasses(agg.classes || []);
        }

        if (isEditMode) {
          const examRes = await fetch(`${API_BASE_URL}/admin/exams/${examToEdit.id}`);
          const examData = await examRes.json();
          if (cancel) return;
          setDetails({
            title: examData.title || '',
            description: examData.description || '',
            class_id: examData.class_id ? String(examData.class_id) : '',
            section: examData.section || '',
            subject_id: examData.subject_id ? String(examData.subject_id) : '',
            time_limit_mins: examData.time_limit_mins || 0,
            status: examData.status || 'published'
          });
          const qs = (examData.questions || []).map((q, idx) => ({
            id: q.id || idx,
            question_text: q.question_text || '',
            question_type: q.question_type || 'multiple_choice',
            options: q.options || { A: '', B: '', C: '', D: '' },
            correct_answer: q.correct_answer || '',
            marks: q.marks || 1
          }));
          setQuestions(qs.length ? qs : [newQuestion()]);
        }
      } catch (e) { console.error('bootstrap:', e); }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [examToEdit, isEditMode, user, isTeacher, isAllAccess]);

  // Filtered subjects when teacher (only their assigned subjects)
  const availableSubjects = useMemo(() => {
    if (isAllAccess || !isTeacher) return subjects;
    if (allTeacherSubjects.length === 0) return subjects;
    return subjects.filter(s => allTeacherSubjects.includes(s.id));
  }, [subjects, isAllAccess, isTeacher, allTeacherSubjects]);

  // -----------------------------------------------------------------
  // Question manipulation
  // -----------------------------------------------------------------
  const addQuestion = () => setQuestions(prev => [...prev, newQuestion()]);
  const removeQuestion = (id) => setQuestions(prev => prev.filter(q => q.id !== id));

  const updateQuestion = (id, field, value) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      const next = { ...q, [field]: value };
      if (field === 'question_type') {
        if (value === 'multiple_choice') {
          next.options = q.options || { A: '', B: '', C: '', D: '' };
          next.correct_answer = q.correct_answer || '';
        } else {
          next.options = null;
          next.correct_answer = null;
        }
      }
      return next;
    }));
  };

  const updateOption = (id, key, value) =>
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, options: { ...q.options, [key]: value } } : q
    ));

  // -----------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------
  const handleSave = async () => {
    if (!details.title.trim()) return alert('Title is required.');
    if (!details.class_id) return alert('Pick a class.');
    if (questions.length === 0) return alert('Add at least one question.');

    for (const q of questions) {
      if (!q.question_text.trim()) return alert('Every question needs text.');
      if (q.question_type === 'multiple_choice') {
        const filled = Object.values(q.options || {}).filter(v => v.trim()).length;
        if (filled < 2) return alert('MCQ needs at least 2 options.');
        if (!q.correct_answer) return alert('MCQ needs a correct answer.');
      }
    }

    setSaving(true);
    try {
      const sanitized = questions.map(q => ({
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        marks: parseInt(q.marks, 10) || 1,
        options: q.question_type === 'multiple_choice' ? q.options : null,
        correct_answer: q.question_type === 'multiple_choice' ? q.correct_answer : null
      }));

      const body = {
        institutionId: user.institutionId,
        title: details.title.trim(),
        description: details.description.trim() || null,
        class_id: parseInt(details.class_id, 10),
        section: details.section.trim() || null,
        subject_id: details.subject_id ? parseInt(details.subject_id, 10) : null,
        time_limit_mins: parseInt(details.time_limit_mins, 10) || 0,
        status: details.status,
        created_by: user.id,
        questions: sanitized
      };

      const url = isEditMode
        ? `${API_BASE_URL}/admin/exams/${examToEdit.id}`
        : `${API_BASE_URL}/admin/exams`;
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      alert(`Exam ${isEditMode ? 'updated' : 'created'}.`);
      onFinish();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="text-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto" /></div>
    );
  }

  const totalMarks = questions.reduce((s, q) => s + (parseInt(q.marks, 10) || 0), 0);

  return (
    <div className="space-y-5">
      <button onClick={onFinish}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600">
        <ArrowLeft size={14} /> Cancel
      </button>

      {isEditMode && examToEdit?.submission_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            This exam has <strong>{examToEdit.submission_count}</strong> submission(s).
            Removing or restructuring questions will affect existing graded scores.
          </div>
        </div>
      )}

      {/* Details card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-black text-slate-800">Exam Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Title" required>
            <input value={details.title} onChange={e => setDetails({ ...details, title: e.target.value })}
              placeholder="e.g. Mid-Term Physics Test" className={inputCls} />
          </FormField>
          <FormField label="Time Limit (minutes)">
            <input type="number" min="0" value={details.time_limit_mins}
              onChange={e => setDetails({ ...details, time_limit_mins: e.target.value })}
              placeholder="0 = no limit" className={inputCls} />
          </FormField>

          <FormField label="Class" required>
            <select value={details.class_id} onChange={e => setDetails({ ...details, class_id: e.target.value })}
              className={inputCls}>
              <option value="">Select class…</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.className}{c.section ? ` - ${c.section}` : ''}
                </option>
              ))}
            </select>
            {isTeacher && !isAllAccess && classes.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">You're not assigned to any class in Timetable.</p>
            )}
          </FormField>

          <FormField label="Section (optional)">
            <input value={details.section} onChange={e => setDetails({ ...details, section: e.target.value })}
              placeholder="Leave blank for all sections" className={inputCls} />
          </FormField>

          <FormField label="Subject">
            <select value={details.subject_id} onChange={e => setDetails({ ...details, subject_id: e.target.value })}
              className={inputCls}>
              <option value="">— Optional —</option>
              {availableSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Status">
            <select value={details.status} onChange={e => setDetails({ ...details, status: e.target.value })}
              className={inputCls}>
              <option value="published">Published (students can attempt)</option>
              <option value="draft">Draft (hidden from students)</option>
              <option value="closed">Closed (no new attempts)</option>
            </select>
          </FormField>

          <div className="md:col-span-2">
            <FormField label="Description (optional)">
              <textarea value={details.description}
                onChange={e => setDetails({ ...details, description: e.target.value })}
                rows={2} placeholder="Brief context for students" className={inputCls + ' resize-none'} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Questions card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="font-black text-slate-800">Questions</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {questions.length} question{questions.length === 1 ? '' : 's'} · {totalMarks} total marks
            </p>
          </div>
          <button onClick={addQuestion}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Plus size={12} /> Add Question
          </button>
        </div>

        <div className="p-6 space-y-4">
          {questions.map((q, idx) => (
            <QuestionEditor key={q.id} index={idx} question={q}
              onChange={(field, value) => updateQuestion(q.id, field, value)}
              onOptionChange={(key, value) => updateOption(q.id, key, value)}
              onRemove={() => removeQuestion(q.id)} />
          ))}
          {questions.length === 0 && (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center italic text-slate-400">
              No questions — add one above.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onFinish} disabled={saving}
          className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-100">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : (isEditMode ? 'Save Changes' : 'Create Exam')}
        </button>
      </div>
    </div>
  );
}


// =====================================================================
//  QuestionEditor — single question card in the editor
// =====================================================================
function QuestionEditor({ index, question, onChange, onOptionChange, onRemove }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative">
      <button onClick={onRemove}
        className="absolute top-4 right-4 text-slate-400 hover:text-red-500" title="Remove">
        <X size={16} />
      </button>

      <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
          {index + 1}
        </span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question</span>
      </div>

      <div className="space-y-4 pr-6">
        <textarea value={question.question_text} onChange={e => onChange('question_text', e.target.value)}
          rows={2} placeholder="Enter the question…"
          className={inputCls + ' resize-none'} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Type">
            <select value={question.question_type} onChange={e => onChange('question_type', e.target.value)}
              className={inputCls}>
              <option value="multiple_choice">Multiple Choice (auto-graded)</option>
              <option value="short_answer">Written Answer (manual grading)</option>
            </select>
          </FormField>
          <FormField label="Marks">
            <input type="number" min="1" value={question.marks}
              onChange={e => onChange('marks', e.target.value)} className={inputCls} />
          </FormField>
        </div>

        {question.question_type === 'multiple_choice' && question.options && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Options</label>
            {Object.keys(question.options).map(key => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-500 flex items-center justify-center">
                  {key}
                </span>
                <input value={question.options[key]} placeholder={`Option ${key}`}
                  onChange={e => onOptionChange(key, e.target.value)}
                  className={inputCls + ' flex-1'} />
              </div>
            ))}
            <FormField label="Correct Answer">
              <select value={question.correct_answer} onChange={e => onChange('correct_answer', e.target.value)}
                className={inputCls}>
                <option value="">Pick correct option…</option>
                {Object.keys(question.options).map(key =>
                  question.options[key].trim() && (
                    <option key={key} value={key}>{key} · {question.options[key]}</option>
                  ))}
              </select>
            </FormField>
          </div>
        )}

        {question.question_type === 'short_answer' && (
          <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>Written answers are graded manually after students submit.</span>
          </div>
        )}
      </div>
    </div>
  );
}

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