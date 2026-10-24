import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const UserDashboard = () => {
  const [userName, setUserName] = useState('User');
  const [userId, setUserId] = useState('22BCS045');

  useEffect(() => {
    const savedName = localStorage.getItem('nyaya_user_name') || sessionStorage.getItem('nyaya_logged_user');
    const savedId = localStorage.getItem('nyaya_logged_user') || sessionStorage.getItem('nyaya_logged_user');

    if (savedName) {
      let cleanName = savedName;
      if (cleanName.includes('@')) cleanName = cleanName.split('@')[0];
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      setUserName(cleanName);
    }
    if (savedId) {
      setUserId(savedId);
    }
  }, []);

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* LEFT SIDEBAR */}
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
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
              <span className="ml-auto bg-rose-100 text-[#6B1724] px-1.5 py-0.5 rounded-full text-[10px] font-bold">4</span>
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
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-[#6B1724]" />
            <div>
              <p className="text-xs font-bold text-stone-800">{userName}</p>
              <p className="text-[10px] text-stone-500 font-mono">{userId}</p>
            </div>
          </div>
          <Link to="/login" title="Logout" className="text-stone-400 hover:text-[#6B1724] p-1.5 transition">
            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
          </Link>
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-stone-800">Welcome back, <span>{userName}</span> 👋</h1>
            <p className="text-xs text-stone-500">Track current status and institutional redressal actions</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/file-complaint" className="px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5">
              <i className="fa-solid fa-plus text-[10px]"></i> File New Petition
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-[#6B1724]/40 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Petitions</p>
                <h3 className="text-2xl font-extrabold text-stone-800 mt-1 group-hover:text-[#6B1724] transition">12</h3>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1"><i className="fa-solid fa-arrow-up text-[8px]"></i> 20%</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center text-xl"><i className="fa-solid fa-folder-closed"></i></div>
            </Link>
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-amber-400 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">In Review</p>
                <h3 className="text-2xl font-extrabold text-amber-600 mt-1">3</h3>
                <p className="text-[10px] text-stone-400 font-semibold mt-1">Active SLA</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-100/50 text-amber-800 flex items-center justify-center text-xl"><i className="fa-solid fa-hourglass-half"></i></div>
            </Link>
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-emerald-400 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Resolved</p>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">8</h3>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1"><i className="fa-solid fa-arrow-up text-[8px]"></i> 33%</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl"><i className="fa-solid fa-circle-check"></i></div>
            </Link>
            <Link to="/my-petitions" className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between hover:border-rose-400 hover:shadow-md transition block group">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Escalated</p>
                <h3 className="text-2xl font-extrabold text-rose-600 mt-1">1</h3>
                <p className="text-[10px] text-rose-500 font-semibold mt-1">Ombudsman</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl"><i className="fa-solid fa-triangle-exclamation"></i></div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-stone-800">My Recent Petitions</h2>
                <Link to="/my-petitions" className="text-xs text-[#6B1724] font-bold hover:underline flex items-center gap-1">View All <i className="fa-solid fa-arrow-right text-[10px]"></i></Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Petition ID</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">SLA Deadline</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    <tr className="hover:bg-stone-50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[#6B1724]">#NY-1048</td>
                      <td className="py-3 px-3">Harassment & Safety</td>
                      <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">In Review</span></td>
                      <td className="py-3 px-3 font-mono text-rose-600 font-semibold">01h 24m remaining</td>
                      <td className="py-3 px-3 text-right"><Link to="/petition-detail" className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white rounded-lg text-xs font-semibold transition">View</Link></td>
                    </tr>
                    <tr className="hover:bg-stone-50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[#6B1724]">#NY-1047</td>
                      <td className="py-3 px-3">Hostel Facilities</td>
                      <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span></td>
                      <td className="py-3 px-3 font-mono text-stone-400">Completed</td>
                      <td className="py-3 px-3 text-right"><Link to="/petition-detail" className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white rounded-lg text-xs font-semibold transition">View</Link></td>
                    </tr>
                    <tr className="hover:bg-stone-50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[#6B1724]">#NY-1046</td>
                      <td className="py-3 px-3">Academics</td>
                      <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Assigned</span></td>
                      <td className="py-3 px-3 font-mono text-amber-600 font-semibold">06h 10m</td>
                      <td className="py-3 px-3 text-right"><Link to="/petition-detail" className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white rounded-lg text-xs font-semibold transition">View</Link></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-stone-800">SLA Compliance</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">Average resolution performance</p>
              </div>
              <div className="py-4 flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-stone-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-[#6B1724]" strokeDasharray="94, 100" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-extrabold text-[#6B1724]">94%</span>
                    <span className="text-[8px] uppercase tracking-wider text-stone-400 font-bold">On-Time</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500 font-medium">Average Resolution Time:</span>
                <span className="font-bold text-stone-800 font-mono">2.4 days</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;