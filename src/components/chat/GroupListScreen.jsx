"use client"

import React, { useState } from 'react';
import { Search, Plus, MessageSquare, Loader2, Megaphone } from 'lucide-react';
import { getProfileImageSource } from '../../utils/imageHelpers';
import { usePermissions } from '../../Screens/PermissionsContext';

const GroupListScreen = ({ groups, onSelectGroup, selectedGroup, onCreateGroup, loading }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { can, isAllAccess } = usePermissions();
    
    const hasCreateRights = isAllAccess || can('GroupChat', 'edit');

    const filteredGroups = groups.filter(g => 
        g.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    };

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-200">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-200">
                <h1 className="text-xl font-bold text-slate-800">Chats</h1>
                {hasCreateRights && (
                    <button 
                        onClick={onCreateGroup}
                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                        title="New Group"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-100">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search groups..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-100 text-sm text-slate-900 rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                        <span className="text-sm">Loading chats...</span>
                    </div>
                ) : filteredGroups.length > 0 ? (
                    filteredGroups.map(group => {
                        const isSelected = selectedGroup?.id === group.id;
                        const unread = group.unread_count > 0;
                        const isReadOnly = group.is_read_only === 1 || group.is_read_only === true;

                        return (
                            <div 
                                key={group.id} 
                                onClick={() => onSelectGroup(group)}
                                className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-slate-50 ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                                <img 
                                    src={getProfileImageSource(group.group_dp_url)} 
                                    alt="Group DP" 
                                    className="w-12 h-12 rounded-full object-cover bg-slate-200 border border-slate-200" 
                                />
                                <div className="ml-3 flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h3 className="font-semibold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                            {group.name}
                                            {isReadOnly && <Megaphone className="w-3 h-3 text-slate-400" />}
                                        </h3>
                                        <span className={`text-xs whitespace-nowrap ml-2 ${unread ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                                            {renderDate(group.last_message_timestamp || group.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-sm truncate mr-2 ${unread ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                                            {group.last_message_text || "No messages yet"}
                                        </p>
                                        {unread && (
                                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                {group.unread_count > 99 ? '99+' : group.unread_count}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-sm">No groups found</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupListScreen;