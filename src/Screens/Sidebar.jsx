import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './PermissionsContext';
import { MODULES } from './Modules';
import { Search, LogOut } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const { isVisible, loading } = usePermissions();
  const [query, setQuery] = useState('');

  // Filter modules by:
  //   (1) permissions (alwaysVisible items skip the check, e.g. Overview)
  //   (2) search box
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODULES.filter(m => {
      if (!m.alwaysVisible && !isVisible(m.module_name)) return false;
      if (q && !m.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, isVisible]);

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-[calc(100vh-120px)] sticky top-[120px] overflow-hidden shrink-0">
      {/* Header Section */}
      <div className="p-6 pb-2">
        <h2 className="text-2xl font-black text-[#1e293b] tracking-tight leading-none">
          {user?.role || 'Super Admin'}
        </h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">
          Administrative Control
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-5 mt-4 mb-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input
            type="text"
            placeholder="Search Modules..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-6">
        <div className="px-4 mb-3">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Main Menu</span>
        </div>

        {loading ? (
          <div className="px-4 py-3 text-xs text-slate-400 italic">Loading menu…</div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-400 italic text-center">
            No modules available.
          </div>
        ) : (
          visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
              }`}
            >
              {/* Flaticon Image instead of Lucide Icon */}
              <div className={`p-1 rounded-lg transition-colors ${activeTab === item.id ? 'bg-white/20' : 'bg-transparent'}`}>
                <img 
                  src={item.imageSource} 
                  alt={item.label} 
                  className="w-7 h-7 object-contain"
                  // Small filter for active state if icon is too dark, optional
                  style={{ filter: activeTab === item.id ? 'brightness(1.2)' : 'none' }}
                />
              </div>
              
              <span className={`text-sm font-bold tracking-tight ${activeTab === item.id ? 'text-white' : 'text-[#334155]'}`}>
                {item.label}
              </span>
            </button>
          ))
        )}
      </nav>

      {/* User Profile / Logout Section */}
      <div className="p-4 border-t bg-slate-50/50">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-800 truncate">{user?.name || 'User'}</p>
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider">{user?.role || 'Admin'}</p>
          </div>
          <button 
            onClick={logout} 
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}