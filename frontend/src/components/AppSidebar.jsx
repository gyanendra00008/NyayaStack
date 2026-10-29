import React from 'react';
import { useSelector } from 'react-redux';
import UserSidebar from './UserSidebar';
import OfficerSidebar from './OfficerSidebar';
import AdminSidebar from './AdminSidebar';

export default function AppSidebar({ role = null, ...props }) {
  const reduxUser = useSelector((state) => state.auth?.user);
  const userRole = role || reduxUser?.role || localStorage.getItem('nyaya_user_role') || 'user';

  if (userRole === 'admin') {
    return <AdminSidebar {...props} />;
  }
  if (userRole === 'officer') {
    return <OfficerSidebar {...props} />;
  }
  return <UserSidebar {...props} />;
}
