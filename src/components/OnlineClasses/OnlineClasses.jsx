import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';

import TeacherOnlineClasses from './TeacherOnlineClasses';
import StudentOnlineClasses from './StudentOnlineClasses';

export default function OnlineClasses() {
  const { user } = useAuth();
  const { isAllAccess } = usePermissions();

  const role = (user?.role || '').toLowerCase();
  const isStudent = role.includes('student');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {isStudent ? <StudentOnlineClasses /> : <TeacherOnlineClasses canManage={!isStudent} />}
    </div>
  );
}