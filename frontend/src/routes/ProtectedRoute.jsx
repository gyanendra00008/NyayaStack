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

  // If a role is required (e.g. 'officer' or 'admin')
  if (roleRequired) {
    const userRole =
      reduxUser?.role ||
      localStorage.getItem('nyaya_user_role') ||
      (localStorage.getItem('authorityToken') || sessionStorage.getItem('authorityToken') ? 'officer' : null);

    // If user lacks the required role and is not an admin
    if (!userRole || (userRole !== roleRequired && userRole !== 'admin')) {
      return <Navigate to={redirectTo} state={{ from: location, roleMismatch: true }} replace />;
    }
  }

  return children;
}
