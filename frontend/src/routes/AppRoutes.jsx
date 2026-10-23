import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import AuthorityLogin from '../pages/AuthorityLogin.jsx';
import AuthorityRegister from '../pages/AuthorityRegister.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      {/* Student */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Authority */}
      <Route path="/authority/login" element={<AuthorityLogin />} />
      <Route path="/authority/register" element={<AuthorityRegister />} />

      {/* galat URL ho to home pe bhej do */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}