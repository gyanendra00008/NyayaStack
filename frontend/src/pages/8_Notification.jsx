import { useState } from 'react';

const Notifications = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [notifs, setNotifs] = useState([
    { id: 1, type: 'update', dot: 'bg-amber-500', title: 'Your complaint #NY-1048 is now In Review', idText: '#NY-1048', time: '10m ago', desc: 'Assigned to Internal Complaints Committee (ICC). Formal inquiry initiated.', isUnread: true },
    { id: 2, type: 'sla', dot: 'bg-rose-500', isPulse: true, title: '⚠️ SLA Alert: #NY-1048 has 01h 24m remaining', idText: '#NY-1048', time: '1h ago', desc: 'Automated notice: If unaddressed, this grievance will escalate directly to Ombudsman.', isUnread: true },
    { id: 3, type: 'message', dot: 'bg-blue-500', title: '💬 New Message from ICC Officer #04', time: '3h ago', desc: '"Please provide the date and location where the incident occurred..."', isUnread: true },
    { id: 4, type: 'update', dot: 'bg-emerald-500', title: '🎉 Complaint #NY-1047 has been Marked Resolved', idText: '#NY-1047', time: 'Yesterday', desc: 'Hostel plumbing team has restored water pressure in Block B tank.', isUnread: true },
  ]);

  const filtered = activeTab === 'all' ? notifs : notifs.filter(n => n.type === activeTab);
  const unreadCount = notifs.filter(n => n.isUnread).length;

  const filterNotifs = (type) => {
    setActiveTab(type);
  };

  const markAllAsRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, isUnread: false, dot: 'bg-stone-300', isPulse: false })));
    alert('All notifications marked as read.');
  };

  const getDotClass = (n) => {
    if (!n.isUnread) return 'bg-stone-300';
    return `${n.dot} ${n.isPulse ? 'animate-pulse' : ''}`;
  };

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}>
      <aside className="w-64 h-screen bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full">
          <a href="1_landing.html" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm"><i className="fa-solid fa-scale-balanced"></i></div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </a>
          <nav className="p-4 space-y-1 text-xs font-semibold flex-1 overflow-y-auto">
            <a href="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-house w-4"></i> Dashboard</a>
            <a href="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-file-circle-plus w-4"></i> File a Complaint</a>
            <a href="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-folder-open w-4"></i> My Petitions</a>
            <a href="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</a>
            <a className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"><i className="fa-solid fa-bell w-4"></i> Notifications <span className="ml-auto bg-rose-100 text-[#6B1724] px-1.5 py-0.5 rounded-full text-[10px] font-bold">{unreadCount}</span></a>
            <a href="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</a>
            <a href="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</a>
          </nav>
          <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC] shrink-0">
            <div className="flex items-center gap-2.5">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" alt="Avatar" className="w-8 h-8 rounded-full border border-[#6B1724]" />
              <div><p className="text-xs font-bold">Kamakshi</p><p className="text-[10px] text-stone-500 font-mono">22BCS045</p></div>
            </div>
            <a href="2_login.html" className="text-stone-400 hover:text-[#6B1724] p-1.5"><i className="fa-solid fa-arrow-right-from-bracket text-xs"></i></a>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-[#FAF7F2] w-full">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm w-full">
          <div><h1 className="text-lg font-bold">Notifications</h1><p className="text-xs text-stone-500">Real-time status updates and SLA alerts</p></div>
          <button onClick={markAllAsRead} className="text-xs text-[#6B1724] font-bold hover:underline flex items-center gap-1.5"><i className="fa-solid fa-check-double"></i> Mark all read</button>
        </header>

        <div className="flex-1 overflow-y-auto w-full h-full bg-[#FAF7F2]">
          <div className="p-6 md:p-8 w-full h-full flex flex-col space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <button onClick={() => filterNotifs('all')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'all' ? 'bg-[#6B1724] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>All</button>
              <button onClick={() => filterNotifs('update')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'update' ? 'bg-[#6B1724] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Updates</button>
              <button onClick={() => filterNotifs('sla')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'sla' ? 'bg-[#6B1724] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>SLA Alerts</button>
              <button onClick={() => filterNotifs('message')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'message' ? 'bg-[#6B1724] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Messages</button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100 overflow-hidden text-sm w-full min-h-[75vh] flex flex-col">
              {filtered.map((item) => (
                <a key={item.id} href="/petition-detail" className="p-6 flex items-start gap-4 hover:bg-stone-50 transition block">
                  <span className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${getDotClass(item)}`}></span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between"><p className="font-bold text-stone-800 text-[14px]">{item.title.includes('#NY-') ? item.title.split(item.idText || '#NY-')[0] : ''}{item.idText ? <span className="font-mono text-[#6B1724]">{item.idText}</span> : ''}{item.title.includes('#NY-') ? item.title.split(item.idText || '#NY-')[1] || '' : item.title}</p><span className="text-xs text-stone-400 font-mono">{item.time}</span></div>
                    <p className="text-stone-500 text-sm mt-1">{item.desc}</p>
                  </div>
                </a>
              ))}
              <div className="flex-1 bg-[#FAF7F2]/30"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Notifications;