import React from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import AuthorityLogin from "../pages/AuthorityLogin";
import AuthorityRegister from "../pages/AuthorityRegister";
import NotFoundPage from "../pages/NotFoundPage";

import UserDashboard from "../pages/UserDashboard";
import FileComplaint from "../pages/FileComplaint";
import MyPetitions from "../pages/MyPetitions";
import PetitionDetail from "../pages/PetitionDetail";
import Notifications from "../pages/Notifications";
import OfficerDashboard from "../pages/OfficerDashboard";
import AuditLedger from "../pages/AuditLedger";
import PublicTransparency from "../pages/PublicTransparency";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/authority-login" element={<AuthorityLogin />} />
      <Route path="/authority-register" element={<AuthorityRegister />} />
      <Route path="/publictrans" element={<PublicTransparency />} />

      {/* Citizen only */}
      <Route path="/dashboard" element={<ProtectedRoute role="citizen"><UserDashboard /></ProtectedRoute>} />
      <Route path="/file-complaint" element={<ProtectedRoute role="citizen"><FileComplaint /></ProtectedRoute>} />
      <Route path="/my-petitions" element={<ProtectedRoute role="citizen"><MyPetitions /></ProtectedRoute>} />
      <Route path="/petition-detail" element={<ProtectedRoute role="citizen"><PetitionDetail /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute role="citizen"><Notifications /></ProtectedRoute>} />

      {/* Authority only */}
      <Route path="/officerdash" element={<ProtectedRoute role="authority"><OfficerDashboard /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute role="authority"><AuditLedger /></ProtectedRoute>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}