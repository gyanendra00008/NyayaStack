import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import anonymousAvatar from '../assets/anonymous-avatar.svg';
import { notificationApi } from '../services/api';

const hasToken = () => Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'));

const TYPE_META = {
  NEW_COMPLAINT: { icon: 'fa-file-circle-plus', box: 'bg-rose-50 text-[#6B1724]' },
  RESOLVED: { icon: 'fa-circle-check', box: 'bg-emerald-50 text-emerald-700' },
  ESCALATED: { icon: 'fa-arrow-trend-up', box: 'bg-amber-50 text-amber-700' },
};

const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString();
};

const Notifications = () => {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isOfficer = localStorage.getItem('nyaya_user_role') === 'officer';

  useEffect(() => {
    if (!hasToken()) navigate(isOfficer ? '/authority/login' : '/login', { replace: true });
  }, [navigate, isOfficer]);

  const load = useCallback(async () => {
    try {
      const res = await notificationApi.getAll();
      setItems(res.data?.notifications || []);
      setError('');
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.message || e.message || 'Could not load notifications';
      setError(status ? `${msg} (status ${status})` : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const openNotification = (n) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
      notificationApi.markRead(n._id).catch(() => {});
    }
    if (n.complaintId) {
      navigate(isOfficer ? '/officerdash' : `/petition-detail?id=${encodeURIComponent(n.complaintId)}`);
    }
  };

  const markAllRead = () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    notificationApi.markAllRead().catch(() => {});
  };

  const unreadCount = items.filter((n) => !n.isRead).length;
  const shown = filter === 'unread' ? items.filter((n) => !n.isRead) : items;

  const navLink = 'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60';
  const navActive = 'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm';

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authorityToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authorityToken');
  };

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
            {isOfficer ? (
              <>
                <Link to="/officerdash" className={navLink}><i className="fa-solid fa-house w-4"></i> Dashboard</Link>
                <Link to="/notifications" className={navActive}><i className="fa-solid fa-bell w-4"></i> Notifications</Link>
                <Link to="/ledger" className={navLink}><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</Link>
                <Link to="/publictrans" className={navLink}><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" className={navLink}><i className="fa-solid fa-house w-4"></i> Dashboard</Link>
                <Link to="/file-complaint" className={navLink}><i className="fa-solid fa-file-circle-plus w-4"></i> File a Complaint</Link>
                <Link to="/my-petitions" className={navLink}><i className="fa-solid fa-folder-open w-4"></i> My Petitions</Link>
                <Link to="/petition-detail" className={navLink}><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</Link>
                <Link to="/notifications" className={navActive}><i className="fa-solid fa-bell w-4"></i> Notifications</Link>
                <Link to="/ledger" className={navLink}><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</Link>
                <Link to="/publictrans" className={navLink}><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</Link>
              </>
            )}
          </nav>
          <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC] shrink-0">
            <div className="flex items-center gap-2.5">
              <img src={anonymousAvatar} alt="Unknown Identity" className="w-8 h-8 rounded-full border border-[#6B1724]" />
              <div>
                <p className="text-xs font-bold">{localStorage.getItem('nyaya_user_name') || 'User'}</p>
                <p className="text-[10px] text-stone-500 font-mono">{localStorage.getItem('nyaya_logged_user') || (isOfficer ? 'Officer' : 'Student')}</p>
              </div>
            </div>
            <Link to={isOfficer ? '/authority/login' : '/login'} onClick={logout} className="text-stone-400 hover:text-[#6B1724] p-1.5"><i className="fa-solid fa-arrow-right-from-bracket text-xs"></i></Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-[#FAF7F2] w-full">
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 md:px-8 flex items-center justify-between shrink-0 shadow-sm w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => setNavOpen(true)} className="md:hidden text-stone-600 p-1.5" aria-label="Open menu"><i className="fa-solid fa-bars"></i></button>
            <div>
              <h1 className="text-lg font-bold">Notifications</h1>
              <p className="text-xs text-stone-500">
                {isOfficer ? 'New complaints assigned to you' : 'Updates on your complaints'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-bold text-[#6B1724] hover:underline">
              Mark all as read
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto w-full bg-[#FAF7F2]">
          <div className="p-6 md:p-8 w-full max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-5 text-xs font-semibold">
              <button
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'px-3 py-1.5 rounded-full bg-[#6B1724] text-white' : 'px-3 py-1.5 rounded-full bg-stone-200 text-stone-600'}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={filter === 'unread' ? 'px-3 py-1.5 rounded-full bg-[#6B1724] text-white' : 'px-3 py-1.5 rounded-full bg-stone-200 text-stone-600'}
              >
                Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
                <span>{error}</span>
              </div>
            )}

            {loading && <p className="text-sm text-stone-500">Loading notifications…</p>}

            {!loading && !error && shown.length === 0 && (
              <div className="bg-white rounded-2xl border border-stone-200/80 p-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-[#6B1724] flex items-center justify-center text-xl mb-3">
                  <i className="fa-solid fa-bell-slash"></i>
                </div>
                <p className="text-sm font-bold">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {isOfficer
                    ? 'You will be notified here when a complaint is assigned to you.'
                    : 'You will be notified here when a complaint is resolved or escalated.'}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {shown.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.NEW_COMPLAINT;
                return (
                  <button
                    key={n._id}
                    onClick={() => openNotification(n)}
                    className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border shadow-xs transition hover:border-[#6B1724]/40 ${
                      n.isRead ? 'bg-white border-stone-200/80' : 'bg-white border-[#6B1724]/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.box}`}>
                      <i className={`fa-solid ${meta.icon}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm ${n.isRead ? 'font-semibold' : 'font-bold'}`}>{n.title}</p>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#6B1724] mt-1.5 shrink-0" aria-label="Unread"></span>}
                      </div>
                      {n.message && <p className="text-xs text-stone-600 mt-0.5 break-words">{n.message}</p>}
                      <p className="text-[11px] text-stone-400 mt-1.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Notifications;