import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, ShieldCheck, Lock } from 'lucide-react';
import { API_BASE_URL } from '../apiConfig';

// IMPORTANT: must mirror SYSTEM_ROLES in backend/index.js
// These three are seeded for every school and cannot be renamed or deleted.
const SYSTEM_ROLES = ['Super Admin', 'Student', 'Teacher'];
const isSystem = (name) => SYSTEM_ROLES.includes(name);

export default function RolesTab({ data, fetchData, user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleName, setRoleName]       = useState('');

  // Server returns the canonical list too — prefer that, fall back to constant
  const systemRoles = data.systemRoles && data.systemRoles.length ? data.systemRoles : SYSTEM_ROLES;
  const isRoleSystem = (name) => systemRoles.includes(name);

  // Sort: system roles first (in their fixed order), then custom alphabetical
  const sortedRoles = useMemo(() => {
    const sys = [];
    const custom = [];
    (data.roles || []).forEach(r => {
      if (isRoleSystem(r.role_name)) sys.push(r);
      else custom.push(r);
    });
    sys.sort((a, b) => systemRoles.indexOf(a.role_name) - systemRoles.indexOf(b.role_name));
    custom.sort((a, b) => a.role_name.localeCompare(b.role_name));
    return [...sys, ...custom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.roles]);

  // Count users per role
  const userCount = useMemo(() => {
    const map = {};
    (data.users || []).forEach(u => { map[u.role] = (map[u.role] || 0) + 1; });
    return map;
  }, [data.users]);

  const openAdd = () => {
    setEditingRole(null);
    setRoleName('');
    setIsModalOpen(true);
  };

  const openEdit = (r) => {
    if (isRoleSystem(r.role_name)) return;       // double safety
    setEditingRole(r);
    setRoleName(r.role_name);
    setIsModalOpen(true);
  };

  const handleDelete = async (r) => {
    if (isRoleSystem(r.role_name)) {
      return alert(`"${r.role_name}" is a system role and cannot be deleted.`);
    }
    const usersInRole = userCount[r.role_name] || 0;
    if (usersInRole > 0) {
      return alert(`Cannot delete "${r.role_name}" — ${usersInRole} user(s) still assigned. Reassign them first.`);
    }
    if (!window.confirm(`Delete the role "${r.role_name}"?`)) return;
    const res = await fetch(`${API_BASE_URL}/admin/roles/${r.id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to delete role.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = roleName.trim();
    if (!trimmed) return alert('Role name is required.');
    if (isRoleSystem(trimmed)) return alert(`"${trimmed}" is a reserved system role name.`);

    const url = editingRole
      ? `${API_BASE_URL}/admin/roles/${editingRole.id}`
      : `${API_BASE_URL}/admin/roles`;
    const payload = { role_name: trimmed, institutionId: user.institutionId };
    const res = await fetch(url, {
      method: editingRole ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save role.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-start">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Role Definitions</h3>
          <p className="text-sm text-slate-500 max-w-2xl font-medium mt-1">
            Define every kind of user that exists in your institution. These roles become assignable
            in the Users screen and configurable in Permissions.
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 shrink-0">
          <Plus size={18} /> Add Role
        </button>
      </div>

      {/* Grid of role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedRoles.map(r => {
          const locked = isRoleSystem(r.role_name);
          const count  = userCount[r.role_name] || 0;
          return (
            <div key={r.id}
              className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:border-slate-200 transition-all">
              {/* Action buttons top-right — disabled for system roles */}
              <div className="absolute top-4 right-4 flex gap-1">
                <button
                  onClick={() => openEdit(r)}
                  disabled={locked}
                  className={`p-2 rounded-lg transition-all ${
                    locked
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'
                  }`}
                  title={locked ? 'System roles cannot be edited' : 'Edit'}>
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  disabled={locked}
                  className={`p-2 rounded-lg transition-all ${
                    locked
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title={locked ? 'System roles cannot be deleted' : 'Delete'}>
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                {locked
                  ? <Lock size={22} className="text-blue-500" />
                  : <ShieldCheck size={22} className="text-blue-500" />}
              </div>

              {/* Name */}
              <div className="font-bold text-slate-800 text-lg leading-tight">
                {r.role_name}
              </div>

              {/* Metadata row */}
              <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">{count} user{count === 1 ? '' : 's'}</span>
                {locked && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-purple-500">System</span>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {sortedRoles.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-medium">No roles defined yet.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
              <X size={22} />
            </button>
            <h2 className="text-2xl font-black mb-1 text-slate-800">
              {editingRole ? 'Rename Role' : 'Add New Role'}
            </h2>
            <p className="text-slate-400 text-sm font-medium mb-6">
              {editingRole
                ? 'Existing users with this role will be updated automatically.'
                : 'Create a custom role (e.g. Coordinator, Librarian). System roles are already in place.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Role Name *
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Coordinator"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-300 text-sm font-medium"
                />
                {isSystem(roleName.trim()) && (
                  <p className="mt-2 text-xs text-amber-600 font-bold">
                    "{roleName.trim()}" is a reserved system role name.
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-2 mb-1 text-slate-700 font-bold">
                  <Lock size={12} /> System roles are protected
                </div>
                Super Admin, Student, and Teacher exist in every school and cannot be renamed or
                deleted. They guarantee a stable foundation for Timetable, Attendance, Marks, and
                other modules.
              </div>

              <button type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-blue-100">
                {editingRole ? 'Save Changes' : 'Create Role'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}