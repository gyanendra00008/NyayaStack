import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import logo from '../assets/logo.png';
import anonymousAvatar from '../assets/anonymous-avatar.svg';
import { complaintApi, authApi } from '../services/api';
import ChangePasswordModal from '../components/ChangePasswordModal';

const UserDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [userName, setUserName] = useState('User');
  const [userId, setUserId] = useState('');
  const [stats, setStats] = useState({ total: 0, inReview: 0, resolved: 0, escalated: 0 });
  const [recentPetitions, setRecentPetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('nyaya_user_name') || sessionStorage.getItem('nyaya_logged_user');
    const savedRoll = localStorage.getItem('nyaya_user_roll');
    const savedId = localStorage.getItem('nyaya_logged_user') || sessionStorage.getItem('nyaya_logged_user');

    if (savedName) {
      let cleanName = savedName;
      if (cleanName.includes('@')) cleanName = cleanName.split('@')[0];
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      setUserName(cleanName);
    }
    if (savedRoll) {
      setUserId(savedRoll);
    } else if (savedId) {
      setUserId(savedId);
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      setLoading(true);
      // Synchronize live profile details
      authApi.getMe().then((res) => {
        if (res.data?.user) {
          const u = res.data.user;
          if (u.fullName) setUserName(u.fullName);
          if (u.rollNo) setUserId(u.rollNo);
        }
      }).catch(() => {});

      complaintApi.getMyComplaints({ limit: 10 })
        .then((res) => {
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          const inReview = list.filter((p) => p.status === 'In Review' || p.status === 'In Progress' || p.status === 'Filed' || p.status === 'Assigned').length;
          const resolved = list.filter((p) => p.status === 'Resolved').length;
          const escalated = list.filter((p) => p.status === 'Rejected' || p.status === 'Escalated').length;

          setStats({
            total: res.data?.pagination?.total ?? list.length,
            inReview,
            resolved,
            escalated,
          });

          setRecentPetitions(list.slice(0, 5));
        })
        .catch(() => {
          setStats({ total: 0, inReview: 0, resolved: 0, escalated: 0 });
          setRecentPetitions([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authorityToken');
    localStorage.removeItem('nyaya_logged_user');
    localStorage.removeItem('nyaya_user_name');
    localStorage.removeItem('nyaya_user_role');
    sessionStorage.clear();
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="text-stone-800 flex h-dvh w-full overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* LEFT SIDEBAR */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none transform transition-transform duration-200 ${navOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="overflow-y-auto">
          <Link to="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
              <img src={logo} alt="NyayaStack" className="h-full w-full object-cover scale-[1.3]" />
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </Link>

          <nav className="p-4 space-y-1 text-xs font-semibold">
            <Link to="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm">
              <i className="fa-solid fa-house w-4"></i> Dashboard
            </Link>
            <Link to="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-file-circle-plus w-4 text-[#6B1724]"></i> File a Complaint
            </Link>
            <Link to="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-folder-open w-4"></i> My Petitions
            </Link>
            <Link to="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-comments w-4"></i> Inquiry Chat
            </Link>
            <Link to="/notifications" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-bell w-4"></i> Notifications
              {stats.inReview > 0 && (
                <span className="ml-auto bg-rose-100 text-[#6B1724] px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {stats.inReview}
                </span>
              )}
            </Link>
            <Link to="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger
            </Link>
            <Link to="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-chart-pie w-4"></i> Public Transparency
            </Link>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <Link to="/officerdash" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-amber-900 bg-amber-100/50 hover:bg-amber-100 transition text-[11px]">
                <i className="fa-solid fa-user-shield w-4 text-amber-700"></i> Switch to Officer View
              </Link>
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
          <div className="flex items-center gap-2.5">
            <img src={anonymousAvatar} alt="Unknown Identity" className="w-8 h-8 rounded-full object-cover border border-[#6B1724]" />
            <div>
              <p className="text-xs font-bold text-stone-800">{userName}</p>
              <p className="text-[10px] text-stone-500 font-mono">{userId}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-stone-400 hover:text-[#6B1724] p-1.5 transition"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
          </button>
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 md:px-8 flex items-center justify-between shrink-0 shadow-sm gap-2">
          <div className="flex items-center min-w-0">
            <MobileNavToggle onClick={() => setNavOpen(true)} />
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-stone-800 truncate">Welcome back, <span>{userName}</span> 👋</h1>
              <p className="text-xs text-stone-500 hidden sm:block">Track current status and institutional redressal actions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChangePassword(true)}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-key text-[10px] text-[#7a1620]"></i> Change Password
            </button>
            <Link to="/file-complaint" className="px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5">
              <i className="fa-solid fa-plus text-[10px]"></i> File New Petition
            </Link>
          </div>
        </header>

        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-[#6B1724]/40 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Petitions</p>
                <h3 className="text-2xl font-extrabold text-stone-800 mt-1 group-hover:text-[#6B1724] transition">{stats.total}</h3>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1"><i className="fa-solid fa-arrow-up text-[8px]"></i> Active</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center text-xl"><i className="fa-solid fa-folder-closed"></i></div>
            </Link>
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-amber-400 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">In Review</p>
                <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{stats.inReview}</h3>
                <p className="text-[10px] text-stone-400 font-semibold mt-1">Active SLA</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-100/50 text-amber-800 flex items-center justify-center text-xl"><i className="fa-solid fa-hourglass-half"></i></div>
            </Link>
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-emerald-400 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Resolved</p>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.resolved}</h3>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1"><i className="fa-solid fa-arrow-up text-[8px]"></i> Closed</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl"><i className="fa-solid fa-circle-check"></i></div>
            </Link>
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-rose-400 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Escalated</p>
                <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{stats.escalated}</h3>
                <p className="text-[10px] text-rose-500 font-semibold mt-1">Ombudsman</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl"><i className="fa-solid fa-triangle-exclamation"></i></div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-stone-800">My Recent Petitions</h2>
                <Link to="/my-petitions" className="text-xs text-[#6B1724] font-bold hover:underline flex items-center gap-1">View All <i className="fa-solid fa-arrow-right text-[10px]"></i></Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Petition ID</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-stone-400">
                          <i className="fa-solid fa-spinner fa-spin mr-2"></i> Loading your petitions...
                        </td>
                      </tr>
                    ) : recentPetitions.length > 0 ? (
                      recentPetitions.map((p, idx) => (
                        <tr key={p.complaintId || idx} className="hover:bg-stone-50 transition">
                          <td className="py-3 px-3 font-mono font-bold text-[#6B1724]">{p.complaintId}</td>
                          <td className="py-3 px-3">{p.category}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {p.status || 'Filed'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-stone-500">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Active'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Link to={`/petition-detail?id=${encodeURIComponent(p.complaintId)}`} className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white rounded-lg text-xs font-semibold transition">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-lg mb-1">
                              <i className="fa-solid fa-folder-open"></i>
                            </div>
                            <p className="font-bold text-sm text-stone-700">No Complaints Filed Yet</p>
                            <p className="text-xs text-stone-400 max-w-sm">
                              You currently have zero active or resolved petitions on file. Submit your first grievance using the button below.
                            </p>
                            <Link
                              to="/file-complaint"
                              className="mt-2 px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-plus text-[10px]"></i> File a Complaint
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 md:p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-stone-800">SLA Compliance</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">Average resolution performance</p>
              </div>
              <div className="py-4 flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-stone-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-[#6B1724]" strokeDasharray={stats.total > 0 ? "94, 100" : "0, 100"} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-extrabold text-[#6B1724]">
                      {stats.total > 0 ? "94%" : "--"}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider text-stone-400 font-bold">
                      {stats.total > 0 ? "On-Time" : "No Activity"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs gap-2">
                <span className="text-stone-500 font-medium">Average Resolution Time:</span>
                <span className="font-bold text-stone-800 font-mono">
                  {stats.total > 0 ? "2.4 days" : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;