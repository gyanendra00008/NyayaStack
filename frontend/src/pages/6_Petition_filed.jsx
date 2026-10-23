import { useState, useEffect } from 'react';

const MyPetitions = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [petitions, setPetitions] = useState([
    { id: '#NY-1050', category: 'Infrastructure', priority: 'High', status: 'Filed', sla: '02h 10m', slaClass: 'font-mono font-semibold' },
    { id: '#NY-1048', category: 'Harassment & Safety', priority: 'High', status: 'In Review', sla: '01h 24m remaining', slaClass: 'font-mono text-rose-600 font-bold' },
    { id: '#NY-1047', category: 'Hostel & Mess', priority: 'Medium', status: 'Resolved', sla: 'Completed', slaClass: 'font-mono text-stone-400' },
    { id: '#NY-1046', category: 'Academics', priority: 'High', status: 'Escalated', sla: 'Overdue (Ombudsman)', slaClass: 'font-mono text-rose-600 font-bold' },
    { id: '#NY-1045', category: 'Hostel & Mess', priority: 'Low', status: 'Resolved', sla: 'Completed', slaClass: 'font-mono text-stone-400' },
  ]);

  useEffect(() => {
    const localPetitions = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
    if (localPetitions.length > 0) {
      const newOnes = localPetitions.map(p => ({
        id: p.id,
        category: p.category,
        priority: p.priority?.split(' ')[0] || 'Medium',
        status: p.status || 'Filed',
        sla: p.deadline || '24h 00m',
        slaClass: 'font-mono font-semibold text-amber-600',
        isNew: true
      }));
      setPetitions(prev => [...newOnes, ...prev]);
    }
  }, []);

  const getPriorityColor = (priority) => {
    if (priority === 'High') return 'bg-rose-100 text-rose-800';
    if (priority === 'Medium') return 'bg-amber-100 text-amber-800';
    return 'bg-stone-100 text-stone-700';
  };

  const getStatusColor = (status) => {
    if (status === 'Filed') return 'bg-blue-50 text-blue-700 border border-blue-200';
    if (status === 'In Review') return 'bg-amber-50 text-amber-700 border border-amber-200';
    if (status === 'Resolved') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === 'Escalated') return 'bg-rose-50 text-rose-700 border border-rose-200';
    if (status === 'Assigned') return 'bg-purple-50 text-purple-700 border border-purple-200';
    return 'bg-stone-50 text-stone-700 border';
  };

  const filteredPetitions = petitions.filter(p => {
    const matchesStatus = activeFilter === 'all' || p.status.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch = !searchQuery || `${p.id} ${p.category} ${p.status}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleFilter = (status) => {
    setActiveFilter(status);
  };

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}>
      {/* FULL SCREEN LEFT SIDEBAR */}
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <a href="1_landing.html" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </a>

          <nav className="p-4 space-y-1 text-xs font-semibold">
            <a href="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-house w-4"></i> Dashboard
            </a>
            <a href="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-file-circle-plus w-4 text-[#6B1724]"></i> File a Complaint
            </a>
            <a className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm">
              <i className="fa-solid fa-folder-open w-4"></i> My Petitions
            </a>
            <a href="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-comments w-4"></i> Inquiry Chat
            </a>
            <a href="/notifications" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-bell w-4"></i> Notifications
              <span className="ml-auto bg-rose-100 text-[#6B1724] px-1.5 py-0.5 rounded-full text-[10px] font-bold">4</span>
            </a>
            <a href="10_audit_ledger.html" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger
            </a>
            <a href="11_public_transparency.html" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-chart-pie w-4"></i> Public Transparency
            </a>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <a href="9_officer_dashboard.html" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-amber-900 bg-amber-100/50 hover:bg-amber-100 transition text-[11px]">
                <i className="fa-solid fa-user-shield w-4 text-amber-700"></i> Switch to Officer View
              </a>
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
          <div className="flex items-center gap-2.5">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-[#6B1724]" />
            <div>
              <p className="text-xs font-bold text-stone-800">Kamakshi</p>
              <p className="text-[10px] text-stone-500 font-mono">22BCS045</p>
            </div>
          </div>
          <a href="2_login.html" title="Logout" className="text-stone-400 hover:text-[#6B1724] p-1.5 transition">
            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
          </a>
        </div>
      </aside>

      {/* FULL SCREEN RIGHT CONTENT AREA */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-stone-800">My Petitions</h1>
            <p className="text-xs text-stone-500">Track and filter all your institutional complaints</p>
          </div>
          <a href="/file-complaint" className="px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-1.5">
            <i className="fa-solid fa-plus text-[10px]"></i> New Petition
          </a>
        </header>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
          {/* Filter Tabs & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
              {['all', 'Filed', 'Assigned', 'In Review', 'Resolved', 'Escalated'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleFilter(status)}
                  className={`px-3.5 py-1.5 rounded-lg transition ${activeFilter === status ? 'bg-[#6B1724] text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                >
                  {status === 'all' ? `All (${filteredPetitions.length})` : status}
                </button>
              ))}
            </div>

            <div className="relative w-64">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-2.5 text-stone-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search petition #, category..."
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B1724]"
              />
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF5EE] border-b border-stone-200 text-stone-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Petition ID</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">SLA Deadline</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredPetitions.map((p, idx) => (
                    <tr key={idx} className={`hover:bg-stone-50/80 transition ${p.isNew ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#6B1724] flex items-center gap-1.5">
                        <span>{p.id}</span>
                        {p.isNew && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-sans font-bold">New</span>}
                      </td>
                      <td className="py-3.5 px-3">{p.category}</td>
                      <td className="py-3.5 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPriorityColor(p.priority)}`}>{p.priority}</span></td>
                      <td className="py-3.5 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(p.status)}`}>{p.status}</span></td>
                      <td className={`py-3.5 px-3 ${p.slaClass}`}>{p.sla}</td>
                      <td className="py-3.5 px-4 text-right">
                        <a href="/petition-detail" className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${p.isNew ? 'bg-[#6B1724] text-white shadow-sm hover:bg-[#54121C]' : 'bg-stone-100 hover:bg-[#6B1724] hover:text-white'}`}>View Details</a>
                      </td>
                    </tr>
                  ))}
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