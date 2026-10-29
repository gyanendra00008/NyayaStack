import React from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import AuthorityLogin from "../pages/AuthorityLogin";
import AuthorityRegister from "../pages/AuthorityRegister";
import ForgotPassword from "../pages/ForgotPassword";
import NotFoundPage from "../pages/NotFoundPage";

import UserDashboard from "../pages/UserDashboard";
import FileComplaint from "../pages/FileComplaint";
import MyPetitions from "../pages/MyPetitions";
import PetitionDetail from "../pages/PetitionDetail";
import Notifications from "../pages/Notifications";
import OfficerDashboard from "../pages/OfficerDashboard";
import AdminDashboard from "../pages/AdminDashboard";
import AdminAuthorityRequests from "../pages/AdminAuthorityRequests";
import AuditLedger from "../pages/AuditLedger";
import PublicTransparency from "../pages/PublicTransparency";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forget-password" element={<ForgotPassword />} />
      <Route path="/authority-login" element={<AuthorityLogin />} />
      <Route path="/authority/login" element={<AuthorityLogin />} />
      <Route path="/authority-register" element={<AuthorityRegister />} />
      <Route path="/authority/register" element={<AuthorityRegister />} />
      <Route path="/publictrans" element={<PublicTransparency />} />
      <Route path="/public-dashboard" element={<PublicTransparency />} />
      <Route path="/public" element={<PublicTransparency />} />
      <Route path="/transparency" element={<PublicTransparency />} />
      <Route path="/ledger" element={<AuditLedger />} />

      {/* Protected Student / User Pages (Redirects unauthenticated visitors to /login; Officers cannot access) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roleRequired="user">
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/file-complaint"
        element={
          <ProtectedRoute roleRequired="user">
            <FileComplaint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload-complaint"
        element={
          <ProtectedRoute roleRequired="user">
            <FileComplaint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/file-petition"
        element={
          <ProtectedRoute roleRequired="user">
            <FileComplaint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-petition"
        element={
          <ProtectedRoute roleRequired="user">
            <FileComplaint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-petitions"
        element={
          <ProtectedRoute roleRequired="user">
            <MyPetitions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/petition-detail"
        element={
          <ProtectedRoute>
            <PetitionDetail />
          </ProtectedRoute>
        }
      />
      {/* CHANGED: no roleRequired, so both students and officers can open notifications */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />

      {/* Protected Officer / Authority Pages (Redirects unauthenticated visitors to /authority/login) */}
      <Route
        path="/officerdash"
        element={
          <ProtectedRoute redirectTo="/authority/login" roleRequired="officer">
            <OfficerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/authority/dashboard"
        element={
          <ProtectedRoute redirectTo="/authority/login" roleRequired="officer">
            <OfficerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Protected Institutional Administrator Pages (Redirects unauthorized users to /authority/login) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute redirectTo="/authority/login" roleRequired="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute redirectTo="/authority/login" roleRequired="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/authority-requests"
        element={
          <ProtectedRoute redirectTo="/authority/login" roleRequired="admin">
            <AdminAuthorityRequests />
          </ProtectedRoute>
        }
      />

      {/* Fallback 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}