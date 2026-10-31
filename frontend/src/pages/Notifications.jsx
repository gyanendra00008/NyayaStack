import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppSidebar from '../components/AppSidebar';
import { notificationApi } from '../services/api';

const TYPE_STYLE = {
  status: 'bg-amber-100 text-amber-700',
  message: 'bg-rose-100 text-[#6B1724]',
  sla: 'bg-rose-100 text-rose-600',
};

const Notifications = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const role = pathname.startsWith('/officer')
    ? 'officer'
    : pathname.startsWith('/admin')
    ? 'admin'
    : 'user';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await notificationApi.getNotifications();
      if (res.data?.success) {
        setItems(res.data.data || []);
      }
    } catch (err) {
      console.warn('Failed to load notifications from API, using fallback:', err.message);
      setError('Unable to load live notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const shown = filter === 'unread' ? items.filter((n) => !n.read) : items;

  const markRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
    } catch (e) {
      // quiet fallback
    }
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllAsRead();
    } catch (e) {
      // quiet fallback
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openItem = (n) => {
    markRead(n.id);
    if (role === 'admin' && n.id.startsWith('req-')) {
      navigate('/admin/authority-requests');
      return;
    }
    if (n.complaintId && !n.complaintId.startsWith('REQ-')) {
      const targetDetail = role === 'officer' ? `/officer/petition-detail?id=${encodeURIComponent(n.complaintId)}` : `/petition-detail?id=${encodeURIComponent(n.complaintId)}`;
      navigate(targetDetail);
    }
  };

  return (
    <div
      className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}
    >
      {/* ROLE SPECIFIC SIDEBAR (Strictly exact items for user, officer, or admin) */}
      <AppSidebar role={role} unreadCount={unread} />

      {/* RIGHT CONTENT */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-xs">
          <div>
            <h1 className="text-base font-bold text-stone-800">Notifications</h1>
            <p className="text-[11px] text-stone-400">
              {role === 'admin'
                ? 'Institutional alerts, authority requests, and escalated petitions'
                : role === 'officer'
                ? 'Assigned grievance updates and SLA alerts'
                : 'Updates on your complaints, messages and SLA alerts'}
            </p>
          </div>
          <button
            onClick={markAll}
            disabled={!unread}
            className="px-3.5 py-1.5 bg-[#FAF5EE] hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-[#6B1724] transition shadow-xs disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            <i className="fa-solid fa-check-double mr-1.5"></i> Mark all as read
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            {error && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center justify-between">
                <span>{error}</span>
                <button onClick={fetchNotifications} className="text-[#6B1724] underline font-semibold">Retry</button>
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 text-xs font-semibold">
              {[
                ['all', 'All', items.length],
                ['unread', 'Unread', unread],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-full border transition cursor-pointer ${
                    filter === key
                      ? 'bg-[#6B1724] text-white border-[#6B1724]'
                      : 'bg-white text-[#6B1724] border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  {label} <span className="ml-1 opacity-80">{count}</span>
                </button>
              ))}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="p-12 text-center text-xs text-stone-400">
                <i className="fa-solid fa-circle-notch fa-spin text-xl text-[#6B1724] mb-2 block"></i>
                Loading notifications...
              </div>
            )}

            {/* List */}
            {!loading && shown.length === 0 && (
              <div className="bg-white p-8 rounded-2xl border border-stone-200/80 shadow-xs text-center text-xs text-stone-400">
                <i className="fa-regular fa-bell-slash text-2xl mb-2 block text-stone-300"></i>
                {filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}
              </div>
            )}

            {!loading && shown.length > 0 && (
              <div className="space-y-3">
                {shown.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`flex items-start gap-3.5 p-4 rounded-2xl border shadow-xs cursor-pointer transition hover:shadow-md ${
                      n.read
                        ? 'bg-white/70 border-stone-200/80'
                        : 'bg-white border-[#6B1724]/30 border-l-4 border-l-[#6B1724]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                        TYPE_STYLE[n.type] || 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <i className={`fa-solid ${n.icon}`}></i>
                    </div>
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-stone-800 text-[13px]">{n.title}</p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[#6B1724] shrink-0"></span>
                        )}
                      </div>
                      <p className="text-stone-600 mt-0.5 leading-relaxed">{n.text}</p>
                      <p className="text-[10px] text-stone-400 font-mono mt-1.5">
                        {n.complaintId} • {n.time}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="text-[11px] text-[#6B1724] underline shrink-0 cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Notifications;
