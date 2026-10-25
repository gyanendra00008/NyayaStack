import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import MobileNavToggle from '../components/MobileNavToggle';

const DEFAULT_PETITIONS = [
  { id: '#NY-1048', category: 'Harassment & Safety', priority: 'High (Strict SLA 24h)', subject: 'Evening intimidation near Gate No. 2', status: 'In Review', time: '12 Oct, 10:30 AM' },
  { id: '#NY-1047', category: 'Hostel & Mess', priority: 'Medium (Standard SLA 48h)', subject: 'Block B water supply disruption', status: 'Resolved', time: '11 Oct, 04:45 PM' },
  { id: '#NY-1046', category: 'Academics', priority: 'Medium (Standard SLA 48h)', subject: 'CS-301 mid-term marking discrepancy', status: 'Assigned', time: '10 Oct, 11:20 AM' },
];

const STATUS_STYLES = {
  Filed: 'bg-blue-50 text-blue-700 border-blue-200',
  Assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'In Review': 'bg-amber-50 text-amber-700 border-amber-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Escalated: 'bg-rose-50 text-rose-700 border-rose-200',
};

const FILTERS = ['All', 'Filed', 'Assigned', 'In Review', 'Resolved', 'Escalated'];

const MyPetitions = () => {
  const [filter, setFilter] = useState('All');
  const [navOpen, setNavOpen] = useState(false);

  const petitions = useMemo(() => {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
    } catch (e) {
      saved = [];
    }
    return [...saved, ...DEFAULT_PETITIONS];
  }, []);

  const visible = filter === 'All' ? petitions : petitions.filter(p => p.status === filter);

  return (
    <div className="text-stone-800 flex h-dvh w-full overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {navOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setNavOpen(false)} />}

      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 transform transition-transform duration-200 ${navOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
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
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" alt="Avatar" className="w-8 h-8 rounded-full border border-[#6B1724]" />
              <div><p className="text-xs font-bold">Kamakshi</p><p className="text-[10px] text-stone-500 font-mono">22BCS045</p></div>
            </div>
            <Link to="/login" className="text-stone-400 hover:text-[#6B1724] p-1.5"><i className="fa-solid fa-arrow-right-from-bracket text-xs"></i></Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 md:px-8 flex items-center justify-between gap-2 shrink-0 shadow-sm w-full">
          <div className="flex items-center min-w-0">
            <MobileNavToggle onClick={() => setNavOpen(true)} />
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold">My Petitions</h1>
              <p className="text-xs text-stone-500 hidden sm:block">All grievances you have filed and their current status</p>
            </div>
          </div>
          <Link to="/file-complaint" className="px-3 sm:px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5 shrink-0">
            <i className="fa-solid fa-plus text-[10px]"></i> <span className="hidden sm:inline">File New Petition</span>
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 sm:px-4 py-2 rounded-lg transition ${filter === f ? 'bg-[#6B1724] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
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
                  {visible.map((p, idx) => (
                    <tr key={p.id + idx} className="hover:bg-stone-50 transition">
                      <td className="py-3.5 px-5 font-mono font-bold text-[#6B1724]">{p.id}</td>
                      <td className="py-3.5 px-4 max-w-xs truncate">{p.subject}</td>
                      <td className="py-3.5 px-4">{p.category}</td>
                      <td className="py-3.5 px-4 text-stone-500">{(p.priority || '').split(' ')[0]}</td>
                      <td className="py-3.5 px-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLES[p.status] || 'bg-stone-100 text-stone-700 border-stone-200'}`}>{p.status}</span></td>
                      <td className="py-3.5 px-4 text-stone-500 font-mono">{p.time}</td>
                      <td className="py-3.5 px-5 text-right"><Link to="/petition-detail" className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white rounded-lg text-xs font-semibold transition">View</Link></td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan="7" className="py-10 text-center text-stone-400">No petitions with status "{filter}" yet.</td></tr>
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