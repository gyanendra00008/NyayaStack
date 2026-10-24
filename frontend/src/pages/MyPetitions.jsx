import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import anonymousAvatar from '../assets/anonymous-avatar.svg';
import { complaintApi } from '../services/api';

const STATUS_STYLES = {
  Filed: 'bg-blue-50 text-blue-700 border-blue-200',
  Assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'In Review': 'bg-amber-50 text-amber-700 border-amber-200',
  'In Progress': 'bg-purple-50 text-purple-700 border-purple-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Escalated: 'bg-rose-50 text-rose-700 border-rose-200',
  Rejected: 'bg-stone-100 text-stone-600 border-stone-200',
};

const FILTERS = ['All', 'Filed', 'In Review', 'In Progress', 'Resolved', 'Rejected'];

const MyPetitions = () => {
  const [filter, setFilter] = useState('All');
  const [backendPetitions, setBackendPetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (token) {
      setLoading(true);
      complaintApi.getMyComplaints({ limit: 50 })
        .then((res) => {
          if (isMounted && res.data?.data) {
            const mapped = res.data.data.map((c) => ({
              id: c.complaintId,
              subject: c.title,
              category: c.category,
              priority: 'Standard',
              status: c.status || 'Filed',
              isAnonymous: Boolean(c.isAnonymous),
              time: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
              desc: c.description,
              attachments: c.attachments || [],
            }));
            setBackendPetitions(mapped);
          }
        })
        .catch((err) => {
          if (isMounted) {
            // Non-critical, fallback to local storage
            console.warn('Could not load live backend complaints:', err.message);
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => { isMounted = false; };
  }, []);

  const petitions = useMemo(() => {
    // Only real complaints fetched directly from the backend API for this authenticated user
    const combined = [...backendPetitions];
    const seen = new Set();
    return combined.filter((p) => {
      const key = p.id || p.complaintId;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [backendPetitions]);

  const visible = filter === 'All' ? petitions : petitions.filter(p => p.status === filter);

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <aside className="w-64 h-screen bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full">
          <Link to="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0"><img src={logo} alt="NyayaStack" className="h-full w-full object-cover scale-[1.3]" /></div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </Link>
          <nav className="p-4 space-y-1 text-xs font-semibold flex-1 overflow-y-auto">
            <Link to="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-house w-4"></i> Dashboard</Link>
            <Link to="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-file-circle-plus w-4"></i> File a Complaint</Link>
            <Link to="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"><i className="fa-solid fa-folder-open w-4"></i> My Petitions</Link>
            <Link to="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</Link>
            <Link to="/notifications" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-bell w-4"></i> Notifications</Link>
            <Link to="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</Link>
            <Link to="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</Link>
          </nav>
          <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC] shrink-0">
            <div className="flex items-center gap-2.5">
              <img src={anonymousAvatar} alt="Unknown Identity" className="w-8 h-8 rounded-full border border-[#6B1724]" />
              <div><p className="text-xs font-bold">{localStorage.getItem('nyaya_user_name') || 'User'}</p><p className="text-[10px] text-stone-500 font-mono">{localStorage.getItem('nyaya_logged_user') || 'Student'}</p></div>
            </div>
            <Link to="/login" onClick={() => localStorage.removeItem('token')} className="text-stone-400 hover:text-[#6B1724] p-1.5"><i className="fa-solid fa-arrow-right-from-bracket text-xs"></i></Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-[#FAF7F2] w-full">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm w-full">
          <div><h1 className="text-lg font-bold">My Petitions</h1><p className="text-xs text-stone-500">All grievances you have filed and their current status</p></div>
          <Link to="/file-complaint" className="px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5">
            <i className="fa-solid fa-plus text-[10px]"></i> File New Petition
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg transition ${filter === f ? 'bg-[#6B1724] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF5EE] border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Petition ID</th>
                    <th className="py-3.5 px-4">Subject</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Filed</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-stone-400">
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i> Loading your petitions...
                      </td>
                    </tr>
                  ) : (
                    visible.map((p, idx) => (
                      <tr key={(p.id || idx) + idx} className="hover:bg-stone-50 transition">
                        <td className="py-3.5 px-5 font-mono font-bold text-[#6B1724]">{p.id}</td>
                        <td className="py-3.5 px-4 max-w-xs truncate" title={p.subject}>
                          <div className="flex items-center gap-1.5 truncate">
                            {p.isAnonymous && (
                              <span title="Anonymous Docket" className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[10px] font-bold shrink-0">
                                <i className="fa-solid fa-user-secret mr-1"></i>Anon
                              </span>
                            )}
                            <span className="truncate">{p.subject}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium">{p.category}</td>
                        <td className="py-3.5 px-4 text-stone-500">{(p.priority || 'Standard').split(' ')[0]}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLES[p.status] || 'bg-stone-100 text-stone-700 border-stone-200'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-stone-500 font-mono">{p.time}</td>
                        <td className="py-3.5 px-5 text-right">
                          <Link
                            to={`/petition-detail?id=${encodeURIComponent(p.id)}`}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white rounded-lg text-xs font-semibold transition"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && visible.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-stone-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <i className="fa-solid fa-folder-open text-3xl text-stone-300"></i>
                          <p className="font-semibold text-sm text-stone-600">No Complaints Found</p>
                          <p className="text-xs text-stone-400">
                            {filter === 'All'
                              ? 'You have not submitted any complaints yet.'
                              : `No complaints with status "${filter}".`}
                          </p>
                          {filter === 'All' && (
                            <Link
                              to="/file-complaint"
                              className="mt-2 px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-plus text-[10px]"></i> File New Petition
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MyPetitions;
