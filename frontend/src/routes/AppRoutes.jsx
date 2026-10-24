import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import AuthorityLogin from '../pages/AuthorityLogin.jsx';
import AuthorityRegister from '../pages/AuthorityRegister.jsx';
import UserDashboard from '../pages/4_UserDashboard.jsx';
import FileComplaint from '../pages/5_File_Complaints.jsx';
import MyPetitions from '../pages/6_Petition_filed.jsx';
import PetitionDetails from '../pages/7_Petition_detail.jsx';
import Notifications from '../pages/8_Notification.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      {/* Student auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Authority auth */}
      <Route path="/authority/login" element={<AuthorityLogin />} />
      <Route path="/authority/register" element={<AuthorityRegister />} />

      {/* Student pages (4 to 8) */}
      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/file-complaint" element={<FileComplaint />} />
      <Route path="/my-petitions" element={<MyPetitions />} />
      <Route path="/petition-detail" element={<PetitionDetails />} />
      <Route path="/notifications" element={<Notifications />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}