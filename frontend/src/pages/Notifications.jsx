import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import anonymousAvatar from '../assets/anonymous-avatar.svg';

// NOTE: Yeh sample data hai. Agar aapke paas original INITIAL array ya API call thi,
// to use yahan wapas daal dena.
const INITIAL = [
  {
    id: 1,
    type: 'status',
    icon: 'fa-circle-info',
    title: 'Status updated',
    text: 'Your petition has moved to In Review.',
    complaintId: 'NS-0001',
    time: '12 Oct, 3:00 PM',
    read: false,
  },
  {
    id: 2,
    type: 'message',
    icon: 'fa-comments',
    title: 'New message from ICC Officer',
    text: 'Please provide the date and time of the incident.',
    complaintId: 'NS-0001',
    time: '12 Oct, 3:05 PM',
    read: false,
  },
  {
    id: 3,
    type: 'sla',
    icon: 'fa-clock',
    title: 'SLA alert',
    text: 'Response deadline is approaching for your petition.',
    complaintId: 'NS-0002',
    time: '11 Oct, 9:30 AM',
    read: true,
  },
  {
    id: 4,
    type: 'ledger',
    icon: 'fa-fingerprint',
    title: 'Ledger entry recorded',
    text: 'An audit ledger entry was added for your petition.',
    complaintId: 'NS-0002',
    time: '10 Oct, 6:45 PM',
    read: true,
  },
];

const TYPE_STYLE = {
  status: 'bg-amber-100 text-amber-700',
  message: 'bg-rose-100 text-[#6B1724]',
  sla: 'bg-rose-100 text-rose-600',
  ledger: 'bg-emerald-100 text-emerald-700',
};

const Notifications = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(INITIAL);
  const [filter, setFilter] = useState('all');

  const role = localStorage.getItem('nyaya_user_role');
  const isOfficer = role === 'officer' || role === 'admin';

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const shown = filter === 'unread' ? items.filter((n) => !n.read) : items;

  const markRead = (id) => {
    // TODO: PATCH /api/notifications/:id/read
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };
  const markAll = () => {
    // TODO: PATCH /api/notifications/read-all
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };
  const openItem = (n) => {
    markRead(n.id);
    navigate(`/petition-detail?id=${encodeURIComponent(n.complaintId)}`);
  };

  const navItem = 'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition';

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}>
      {/* LEFT SIDEBAR */}
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <Link to="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </Link>

          <nav className="p-4 space-y-1 text-xs font-semibold">
            <Link to="/dashboard" className={navItem}><i className="fa-solid fa-house w-4"></i> Dashboard</Link>
            {!isOfficer && (
              <Link to="/file-complaint" className={navItem}><i className="fa-solid fa-file-circle-plus w-4 text-[#6B1724]"></i> File a Complaint</Link>
            )}
            <Link to="/my-petitions" className={navItem}><i className="fa-solid fa-folder-open w-4"></i> My Petitions</Link>
            <Link to="/petition-detail" className={navItem}><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</Link>
            <Link to="/notifications" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm">
              <i className="fa-solid fa-bell w-4"></i> Notifications
              {unread > 0 && (
                <span className="ml-auto bg-rose-100 text-[#6B1724] px-1.5 py-0.5 rounded-full text-[10px] font-bold">{unread}</span>
              )}
            </Link>
            <Link to="/ledger" className={navItem}><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</Link>
            <Link to="/publictrans" className={navItem}><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</Link>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              {/* <Link to="/officerdash" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-amber-900 bg-amber-100/50 hover:bg-amber-100 transition text-[11px]">
                <i className="fa-solid fa-user-shield w-4 text-amber-700"></i> Switch to Officer View
              </Link> */}
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
          <div className="flex items-center gap-2.5">
            <img src={anonymousAvatar} alt="Unknown Identity" className="w-8 h-8 rounded-full object-cover border border-[#6B1724]" />
            <div>
              <p className="text-xs font-bold text-stone-800">User</p>
              <p className="text-[10px] text-stone-500 font-mono">Enter here</p>
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
            <h1 className="text-base font-bold text-stone-800">Notifications</h1>
            <p className="text-[11px] text-stone-400">Updates on your complaints, messages and SLA alerts</p>
          </div>
          <button onClick={markAll} disabled={!unread}
            className="px-3.5 py-1.5 bg-[#FAF5EE] hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-[#6B1724] transition shadow-sm disabled:opacity-40 disabled:cursor-default">
            <i className="fa-solid fa-check-double mr-1.5"></i> Mark all as read
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2 text-xs font-semibold">
              {[['all', 'All', items.length], ['unread', 'Unread', unread]].map(([key, label, count]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-full border transition ${filter === key ? 'bg-[#6B1724] text-white border-[#6B1724]' : 'bg-white text-[#6B1724] border-stone-300 hover:bg-stone-100'}`}>
                  {label} <span className="ml-1 opacity-80">{count}</span>
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-3">
              {shown.length === 0 && (
                <div className="bg-white p-8 rounded-2xl border border-stone-200/80 shadow-sm text-center text-xs text-stone-400">
                  <i className="fa-regular fa-bell-slash text-2xl mb-2 block"></i>
                  {filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}
                </div>
              )}
              {shown.map((n) => (
                <div key={n.id} onClick={() => openItem(n)}
                  className={`flex items-start gap-3.5 p-4 rounded-2xl border shadow-sm cursor-pointer transition hover:shadow-md ${n.read ? 'bg-white/70 border-stone-200/80' : 'bg-white border-[#6B1724]/30 border-l-4 border-l-[#6B1724]'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${TYPE_STYLE[n.type] || 'bg-stone-100 text-stone-600'}`}>
                    <i className={`fa-solid ${n.icon}`}></i>
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-800 text-[13px]">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#6B1724] shrink-0"></span>}
                    </div>
                    <p className="text-stone-600 mt-0.5 leading-relaxed">{n.text}</p>
                    <p className="text-[10px] text-stone-400 font-mono mt-1.5">{n.complaintId} • {n.time}</p>
                  </div>
                  {!n.read && (
                    <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="text-[11px] text-[#6B1724] underline shrink-0">Mark read</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Notifications;
