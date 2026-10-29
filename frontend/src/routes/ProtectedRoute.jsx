import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Strict Role-Based ProtectedRoute Wrapper
 * - Unauthenticated visitors are redirected to the appropriate role login page.
 * - Authenticated users who lack permission for a dashboard/page are redirected
 *   to their own role-authorized console.
 * - Pending or rejected authorities are blocked from the officer console.
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

  // Determine appropriate login fallback based on roleRequired
  const effectiveRedirect =
    redirectTo ||
    (roleRequired === 'admin'
      ? '/admin/login'
      : roleRequired === 'officer'
      ? '/authority/login'
      : '/login');

  if (!token) {
    // Unauthenticated visitor -> redirect to appropriate login portal
    return <Navigate to={effectiveRedirect} state={{ from: location }} replace />;
  }

  const userRole =
    reduxUser?.role ||
    localStorage.getItem('nyaya_user_role') ||
    'user';

  // 1. If roleRequired is 'user': ONLY regular users allowed
  if (roleRequired === 'user') {
    if (userRole !== 'user') {
      const authorizedTarget = userRole === 'admin' ? '/admin/dashboard' : '/officerdash';
      return <Navigate to={authorizedTarget} replace />;
    }
  }

  // 2. If roleRequired is 'officer': ONLY approved officers allowed
  if (roleRequired === 'officer') {
    if (userRole !== 'officer') {
      const authorizedTarget = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';
      return <Navigate to={authorizedTarget} replace />;
    }

    const verificationStatus =
      reduxUser?.verificationStatus ||
      localStorage.getItem('nyaya_verification_status');

    if (verificationStatus && verificationStatus !== 'approved') {
      return <Navigate to="/authority/login" state={{ from: location, notApproved: true }} replace />;
    }
  }

  // 3. If roleRequired is 'admin': ONLY institutional administrators allowed
  if (roleRequired === 'admin') {
    if (userRole !== 'admin') {
      const authorizedTarget = userRole === 'officer' ? '/officerdash' : '/dashboard';
      return <Navigate to={authorizedTarget} replace />;
    }
  }

  return children;
}
