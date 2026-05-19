import React, { useState, useMemo, useEffect } from 'react';
import { GraduationCap, Users as UsersIcon, UserCog, ClipboardCheck, History } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import RosterMarker from './RosterMarker';
import AttendanceHistory from './AttendanceHistory';
import { Search } from 'lucide-react';
import { API_BASE_URL } from '../../apiConfig';
import { useCallback } from 'react';

// =====================================================================
//  Attendance — Top-level container
//  Three category tabs (Students / Teachers / Other) × two action
//  sub-tabs (Mark / History).
//
//  Access rules:
//    • Super Admin           → full access everywhere
//    • Student               → only own history (Students tab → History)
//    • Teacher               → mark Students (their classes), view own history
//    • Custom role           → only own history by default; mark only if
//                              Super Admin granted edit permission on
//                              the Attendance module.
// =====================================================================

export default function Attendance() {
  const { user } = useAuth();
  const { can, isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role === 'student';
  const isTeacher = role.includes('teacher');
  const isSuper   = isAllAccess; // covers Super Admin and Developer

  const canMark = isSuper || isTeacher || can('Attendance', 'edit');

  // Which category tabs are visible to this user?
  const categories = useMemo(() => {
    if (isSuper)   return ['students', 'teachers', 'other'];
    if (isTeacher) return ['students', 'teachers']; // teacher marks students, views own
    if (isStudent) return ['students'];             // sees only their history
    // Custom roles — show everything they have any kind of access to
    return ['students', 'teachers', 'other'];
  }, [isSuper, isTeacher, isStudent]);

  const [category, setCategory] = useState(categories[0]);
  const [mode, setMode] = useState('mark'); // 'mark' | 'history'

  // If the user can't mark at all, lock them to history view
  useEffect(() => {
    if (!canMark) setMode('history');
  }, [canMark]);

  // Students/custom-role users see only their own history; force category+mode
  const forceSelfHistory = isStudent || (!isSuper && !isTeacher && !can('Attendance', 'edit'));

  const categoryConfig = {
    students: { label: 'Students', icon: GraduationCap },
    teachers: { label: 'Teachers', icon: UsersIcon },
    other:    { label: 'Other',    icon: UserCog }
  };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (forceSelfHistory) {
    return (
      <div className="space-y-6">
        <Header subtitle="Your attendance history" />
        <AttendanceHistory userId={user.id} userName={user.name} selfOnly />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header subtitle="Mark and review daily attendance" />

      {/* Category Tabs (Students / Teachers / Other) */}
      <div className="flex justify-center">
        <div className="inline-flex bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm">
          {categories.map(key => {
            const cfg = categoryConfig[key];
            const Icon = cfg.icon;
            const active = category === key;
            return (
              <button key={key}
                onClick={() => setCategory(key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}>
                <Icon size={16} /> {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode toggle (Mark / History) */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          {canMark && (
            <button
              onClick={() => setMode('mark')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                mode === 'mark' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <ClipboardCheck size={14} /> Mark
            </button>
          )}
          <button
            onClick={() => setMode('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              mode === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <History size={14} /> History
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'mark' ? (
        <RosterMarker category={category} />
      ) : (
        <HistoryPicker category={category} />
      )}
    </div>
  );
}

function Header({ subtitle }) {
  return (
    <div className="text-center sm:text-left">
      <h1 className="text-3xl font-black text-slate-900 tracking-tight">Attendance</h1>
      <p className="text-slate-500 font-medium mt-1">{subtitle}</p>
    </div>
  );
}


// =====================================================================
//  HistoryPicker — for Super Admin/teacher/custom-role looking at
//  someone *else's* history. Lets them pick a user from a category.
// =====================================================================

function HistoryPicker({ category }) {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();
  const role = (user?.role || '').toLowerCase();
  const isTeacher = role.includes('teacher');

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [loading, setLoading] = useState(true);

  // Teacher in "teachers" tab → just shortcut to their own history
  const teacherViewingTeachers = !isAllAccess && isTeacher && category === 'teachers';

  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const url = `${API_BASE_URL}/admin/attendance/roster/${user.institutionId}?category=${category}&date=${today}`;
      const res = await fetch(url);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, category]);

  useEffect(() => {
    if (!teacherViewingTeachers) loadRoster();
    else setLoading(false);
  }, [loadRoster, teacherViewingTeachers]);

  if (teacherViewingTeachers) {
    return <AttendanceHistory userId={user.id} userName={user.name} selfOnly />;
  }

  if (picked) {
    return (
      <div className="space-y-3">
        <button onClick={() => setPicked(null)}
          className="text-sm font-bold text-blue-600 hover:text-blue-700">
          ← Back to {category} list
        </button>
        <AttendanceHistory userId={picked.id} userName={picked.name} />
      </div>
    );
  }

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-md mx-auto">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder={`Search ${category}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 font-medium">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-medium">No {category} found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setPicked(u)}>
                  <td className="p-4 flex items-center gap-3">
                    {u.profile_pic ? (
                      <img src={u.profile_pic} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-700 text-sm">{u.name}</div>
                      {u.username && <div className="text-xs text-slate-400">@{u.username}</div>}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-500">{u.role}</td>
                  <td className="p-4 text-right text-sm font-bold text-blue-600">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}