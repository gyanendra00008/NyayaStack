import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import UserSidebar from './UserSidebar';
import OfficerSidebar from './OfficerSidebar';
import AdminSidebar from './AdminSidebar';

export default function AppSidebar({ role = null, ...props }) {
  const { pathname } = useLocation();
  const reduxUser = useSelector((state) => state.auth?.user);

  let userRole = role;
  if (!userRole) {
    if (pathname.startsWith('/officer') || pathname.startsWith('/authority')) {
      userRole = 'officer';
    } else if (pathname.startsWith('/admin')) {
      userRole = 'admin';
    } else {
      userRole = reduxUser?.role || localStorage.getItem('nyaya_user_role') || 'user';
    }
  }

  if (userRole === 'admin') {
    return <AdminSidebar {...props} />;
  }
  if (userRole === 'officer') {
    return <OfficerSidebar {...props} />;
  }
  return <UserSidebar {...props} />;
}
