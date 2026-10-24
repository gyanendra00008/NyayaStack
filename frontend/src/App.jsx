import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import VerifyOtpPage from "./pages/VerifyOtpPage.jsx";
import AuthorityLogin from "./pages/AuthorityLogin.jsx";
import AuthorityRegister from "./pages/AuthorityRegister.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

import UserDashboard from "./pages/UserDashboard.jsx";
import FileComplaint from "./pages/FileComplaint.jsx";
import MyPetitions from "./pages/MyPetitions.jsx";
import PetitionDetail from "./pages/PetitionDetail.jsx";
import Notifications from "./pages/Notifications.jsx";
import OfficerDashboard from "./pages/OfficerDashboard.jsx";
import AuditLedger from "./pages/AuditLedger.jsx";
import PublicTransparency from "./pages/PublicTransparency.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/authority-login" element={<AuthorityLogin />} />
        <Route path="/authority-register" element={<AuthorityRegister />} />

        {/* Citizen */}
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/file-complaint" element={<FileComplaint />} />
        <Route path="/my-petitions" element={<MyPetitions />} />
        <Route path="/petition-detail" element={<PetitionDetail />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* Officer */}
        <Route path="/officerdash" element={<OfficerDashboard />} />
        <Route path="/ledger" element={<AuditLedger />} />
        <Route path="/publictrans" element={<PublicTransparency />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;