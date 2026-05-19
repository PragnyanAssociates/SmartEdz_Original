import React, { useState, useMemo } from 'react';
import { CalendarDays, PenLine } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import SchedulesManager from './SchedulesManager';
import ExamsManager from './ExamsManager';
import StudentExamsView from './StudentExamsView';
import StudentSchedulesView from './StudentSchedulesView';

// =====================================================================
//  Exams — top-level container
//
//  Two tabs:
//   • Exam Schedules — printable exam timetables
//   • Online Exams   — actual quizzes students take
//
//  Role behaviour:
//   • Students see read-only views (their class's schedules + exams to take)
//   • Teachers/Super Admin/permitted custom roles get full CRUD
// =====================================================================

export default function Exams() {
  const { user } = useAuth();
  const { isAllAccess, can } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const canManage = isAllAccess || isTeacher || can('Exams', 'edit');

  const [tab, setTab] = useState('schedules');

  const tabs = useMemo(() => ([
    { id: 'schedules', label: 'Exam Schedules', icon: CalendarDays },
    { id: 'exams',     label: 'Online Exams',   icon: PenLine }
  ]), []);

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Exams</h1>
        <p className="text-slate-500 font-medium mt-1">
          {isStudent
            ? 'Your exam timetable and tests'
            : 'Publish schedules and create online assessments'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex justify-center">
        <div className="inline-flex bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  active ? 'bg-blue-600 text-white shadow shadow-blue-200'
                         : 'text-slate-500 hover:text-slate-800'
                }`}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'schedules' ? (
        isStudent ? <StudentSchedulesView /> : <SchedulesManager canManage={canManage} />
      ) : (
        isStudent ? <StudentExamsView /> : <ExamsManager canManage={canManage} />
      )}
    </div>
  );
}