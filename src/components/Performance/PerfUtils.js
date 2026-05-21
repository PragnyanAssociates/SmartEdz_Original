// =====================================================================
//  Performance — shared helpers
//  Pure functions used by every Performance component. No hardcoded
//  subjects / exams / max marks — everything is driven by the dataset
//  the backend sends (Section 18).
// =====================================================================

// Custom rounding: > .5 rounds up, <= .5 floors (matches old project).
export function roundPct(value) {
  const v = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(v)) return 0;
  const frac = v - Math.floor(v);
  return frac > 0.5 ? Math.ceil(v) : Math.floor(v);
}

// Performance band → tailwind classes.
export function band(pct) {
  const v = roundPct(pct);
  if (v >= 85) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#10b981', label: 'Excellent' };
  if (v >= 50) return { bar: 'bg-blue-500',    text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    hex: '#3b82f6', label: 'Average' };
  return          { bar: 'bg-red-500',     text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     hex: '#ef4444', label: 'Needs Work' };
}

const classGroupOf = (c) =>
  c ? `${c.className}${c.section ? ' - ' + c.section : ''}` : '';

// ---------------------------------------------------------------------
//  Build per-student totals from a class dataset.
//
//  dataset = { students[], subjects[], examTypes[], marks[] }
//    - each examType has .max_marks (for THIS class)
//    - marks rows: { student_id, subject_id, exam_type_id, marks_obtained }
//
//  opts:
//    examTypeId  — 'overall' | a specific exam_type id
//    subjectId   — 'all'     | a specific subject id
//
//  Returns ranked array:
//    [{ id, name, roll_no, obtained, possible, percentage, rank }]
//  Only students who have at least one mark in the selection appear.
// ---------------------------------------------------------------------
export function buildStudentTotals(dataset, { examTypeId = 'overall', subjectId = 'all' } = {}) {
  if (!dataset || !dataset.students) return [];

  const { students, subjects, examTypes, marks } = dataset;

  // Quick lookups
  const maxByExam = {};
  examTypes.forEach(t => { maxByExam[t.id] = parseFloat(t.max_marks) || 0; });

  const subjectIds = subjectId === 'all'
    ? subjects.map(s => s.id)
    : [parseInt(subjectId, 10)];

  const examIds = examTypeId === 'overall'
    ? examTypes.map(t => t.id)
    : [parseInt(examTypeId, 10)];

  // marks index: `${student}:${subject}:${exam}` → value
  const markIndex = {};
  marks.forEach(m => {
    markIndex[`${m.student_id}:${m.subject_id}:${m.exam_type_id}`] = m.marks_obtained;
  });

  const rows = students.map(stu => {
    let obtained = 0, possible = 0, hasAny = false;

    subjectIds.forEach(sid => {
      examIds.forEach(eid => {
        const raw = markIndex[`${stu.id}:${sid}:${eid}`];
        const val = parseFloat(raw);
        if (raw === undefined || raw === null || raw === '' || isNaN(val)) return;
        obtained += val;
        possible += maxByExam[eid] || 0;
        hasAny = true;
      });
    });

    const percentage = possible > 0 ? roundPct((obtained / possible) * 100) : 0;
    return {
      id: stu.id,
      name: stu.name,
      roll_no: stu.roll_no,
      obtained,
      possible,
      percentage,
      hasAny
    };
  }).filter(r => r.hasAny && r.possible > 0);

  // Rank by raw obtained (desc)
  rows.sort((a, b) => b.obtained - a.obtained);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---------------------------------------------------------------------
//  Per-exam breakdown for ONE student across all subjects.
//  Returns [{ exam_type_id, name, obtained, possible, percentage }]
//  in exam_order, only exams that have data.
// ---------------------------------------------------------------------
export function studentExamBreakdown(dataset, studentId) {
  if (!dataset || !dataset.examTypes) return [];
  const { subjects, examTypes, marks } = dataset;

  const markIndex = {};
  marks.forEach(m => {
    markIndex[`${m.student_id}:${m.subject_id}:${m.exam_type_id}`] = m.marks_obtained;
  });

  const out = [];
  examTypes.forEach(t => {
    let obtained = 0, possible = 0, hasAny = false;
    subjects.forEach(s => {
      const raw = markIndex[`${studentId}:${s.id}:${t.id}`];
      const val = parseFloat(raw);
      if (raw === undefined || raw === null || raw === '' || isNaN(val)) return;
      obtained += val;
      possible += parseFloat(t.max_marks) || 0;
      hasAny = true;
    });
    if (hasAny && possible > 0) {
      out.push({
        exam_type_id: t.id,
        name: t.name,
        obtained,
        possible,
        percentage: roundPct((obtained / possible) * 100)
      });
    }
  });
  return out;
}

export { classGroupOf };