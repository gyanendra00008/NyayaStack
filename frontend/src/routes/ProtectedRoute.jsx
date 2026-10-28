import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Route protection wrapper.
 * Prevents unauthenticated users from reaching private portal pages (e.g. /dashboard).
 * If the user is unauthenticated, they are redirected to /login with state preserved.
 */
export default function ProtectedRoute({ children, roleRequired = null, redirectTo = '/login' }) {
  const location = useLocation();
  const reduxToken = useSelector((state) => state.auth?.token);
  const reduxUser = useSelector((state) => state.auth?.user);

  // Check token in Redux, localStorage, or sessionStorage
  const token =
    reduxToken ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('authorityToken') ||
    sessionStorage.getItem('authorityToken');

  if (!token) {
    // Unauthenticated user -> redirect to login
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  const userRole =
    reduxUser?.role ||
    localStorage.getItem('nyaya_user_role') ||
    (localStorage.getItem('authorityToken') || sessionStorage.getItem('authorityToken') ? 'officer' : 'user');

  // Strict role separation:
  // If roleRequired is 'user' (student) and current user is officer/admin, redirect to officer dashboard
  if (roleRequired === 'user' && (userRole === 'officer' || userRole === 'admin')) {
    return <Navigate to={userRole === 'admin' ? '/admin/dashboard' : '/officerdash'} replace />;
  }

  // If a role is required (e.g. 'officer' or 'admin')
  if (roleRequired && roleRequired !== 'user') {
    // If user lacks the required role and is not an admin
    if (!userRole || (userRole !== roleRequired && userRole !== 'admin')) {
      return <Navigate to={redirectTo} state={{ from: location, roleMismatch: true }} replace />;
    }

    // If role required is officer and user is an officer, verify account approval
    if (userRole === 'officer') {
      const verificationStatus =
        reduxUser?.verificationStatus ||
        localStorage.getItem('nyaya_verification_status');

      if (verificationStatus && verificationStatus !== 'approved') {
        return <Navigate to="/authority/login" state={{ from: location, notApproved: true }} replace />;
      }
    }
  }

  return children;
}
