import React from "react";
import { Routes, Route } from "react-router-dom";

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
import ProtectedRoute from "./ProtectedRoute";

// ✅ FIX 1: Correct Import - Check your file name
// Tumhare project me file ka naam OfficerPetitions.jsx hai ya AssignedPetitions.jsx?
// Jo bhi hai usko yaha lagao. Neeche 2 option diye hai, ek ko uncomment karo.
import AssignedPetitions from "../pages/AdminAuthorityRequests"; 
// import AssignedPetitions from "../pages/AssignedPetitions"; 

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

      {/* Protected Student / User Pages */}
      <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
      <Route path="/file-complaint" element={<ProtectedRoute><FileComplaint /></ProtectedRoute>} />
      <Route path="/upload-complaint" element={<ProtectedRoute><FileComplaint /></ProtectedRoute>} />
      <Route path="/file-petition" element={<ProtectedRoute><FileComplaint /></ProtectedRoute>} />
      <Route path="/new-petition" element={<ProtectedRoute><FileComplaint /></ProtectedRoute>} />
      <Route path="/my-petitions" element={<ProtectedRoute><MyPetitions /></ProtectedRoute>} />
      <Route path="/petition-detail" element={<ProtectedRoute><PetitionDetail /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

      {/* Protected Officer / Authority Pages */}
      <Route path="/officerdash" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="officer"><OfficerDashboard /></ProtectedRoute>} />
      <Route path="/authority/dashboard" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="officer"><OfficerDashboard /></ProtectedRoute>} />
      
      <Route path="/officer/petitions" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="officer"><AssignedPetitions /></ProtectedRoute>} />
      <Route path="/officer/analytics" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="officer"><PublicTransparency /></ProtectedRoute>} />
      <Route path="/officer/ledger" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="officer"><AuditLedger /></ProtectedRoute>} />
      
      {/* ✅ FIX 2: Officer Notifications ke liye alag page - User wala mat use karo */}
      {/* Agar tumhare paas OfficerNotifications.jsx nahi hai to filhal OfficerDashboard hi dikhega */}
      <Route path="/officer/notifications" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="officer"><OfficerDashboard /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/authority-requests" element={<ProtectedRoute redirectTo="/authority/login" roleRequired="admin"><AdminAuthorityRequests /></ProtectedRoute>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}