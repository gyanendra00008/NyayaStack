import React from "react";
import { Routes, Route } from "react-router-dom";

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
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/authority-login" element={<AuthorityLogin />} />
      <Route path="/authority-register" element={<AuthorityRegister />} />
      <Route path="/publictrans" element={<PublicTransparency />} />

      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/file-complaint" element={<FileComplaint />} />
      <Route path="/my-petitions" element={<MyPetitions />} />
      <Route path="/petition-detail" element={<PetitionDetail />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/ledger" element={<AuditLedger />} />

      <Route path="/officerdash" element={<OfficerDashboard />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}