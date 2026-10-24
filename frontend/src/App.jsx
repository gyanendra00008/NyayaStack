import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import UserDashboard from "./pages/4_UserDashboard.jsx";
import FileComplaint from "./pages/5_File_Complaints.jsx";
import MyPetitions from "./pages/6_Petition_filed.jsx";
import PetitionDetail from "./pages/7_Petition_detail.jsx";
import Notifications from "./pages/8_Notification.jsx";
import OfficerDashboard from "./pages/9_officer_dashboard.jsx";
import AuditLedger from "./pages/10_audit_ledger.jsx";
import PublicTransparency from "./pages/11_public_transparency.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/file-complaint" element={<FileComplaint />} />
        <Route path="/my-petitions" element={<MyPetitions />} />
        <Route path="/petition-detail" element={<PetitionDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/officerdash" element={<OfficerDashboard />} />
        <Route path="/ledger" element={<AuditLedger />} />
        <Route path="/publictrans" element={<PublicTransparency />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;