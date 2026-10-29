import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import logo from '../assets/logo.png';
import anonymousAvatar from '../assets/anonymous-avatar.svg';

const USER_LINKS = [
  { to: '/dashboard', icon: 'fa-house', label: 'Dashboard' },
  { to: '/file-complaint', icon: 'fa-file-circle-plus', label: 'File Complaint' },
  { to: '/my-petitions', icon: 'fa-folder-open', label: 'My Petitions' },
  { to: '/notifications', icon: 'fa-bell', label: 'Notifications' },
];

export default function UserSidebar({
  navOpen = false,
  setNavOpen = null,
  unreadCount = 0,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const userName =
    localStorage.getItem('nyaya_user_name') ||
    localStorage.getItem('fullName') ||
    'Student';
  const userId =
    localStorage.getItem('nyaya_logged_user') ||
    localStorage.getItem('username') ||
    localStorage.getItem('rollNumber') ||
    'User';

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <>
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setNavOpen && setNavOpen(false)}
        />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none transform transition-transform duration-200 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 h-full`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <Link
            to="/"
            className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 shrink-0 hover:bg-stone-100/50 transition"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
              <img
                src={logo}
                alt="NyayaStack"
                className="h-full w-full object-cover scale-[1.3]"
              />
            </div>
            <span
              className="font-bold text-lg text-[#6B1724]"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              NyayaStack
            </span>
          </Link>

          <nav className="p-4 space-y-1 text-xs font-semibold flex-1">
            {USER_LINKS.map((item) => {
              const active =
                pathname === item.to ||
                (item.to === '/my-petitions' &&
                  (pathname === '/check-petition' ||
                    pathname === '/check-my-petition' ||
                    pathname === '/petitions' ||
                    pathname === '/petition-filed'));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setNavOpen && setNavOpen(false)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition ${
                    active
                      ? 'bg-[#6B1724] text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-200/60'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-4`}></i>
                  <span>{item.label}</span>
                  {item.to === '/notifications' && unreadCount > 0 && (
                    <span
                      className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        active
                          ? 'bg-white text-[#6B1724]'
                          : 'bg-rose-100 text-[#6B1724]'
                      }`}
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC] shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={anonymousAvatar}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-[#6B1724] shrink-0 object-cover"
              />
              <div className="min-w-0 truncate">
                <p className="text-xs font-bold text-stone-800 truncate">{userName}</p>
                <p className="text-[10px] text-stone-500 font-mono truncate">{userId}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-stone-400 hover:text-[#6B1724] p-1.5 transition cursor-pointer ml-2 shrink-0"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
