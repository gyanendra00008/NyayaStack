import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { complaintApi } from '../services/api';
import UserSidebar from '../components/UserSidebar';
import MobileNavToggle from '../components/MobileNavToggle';

const STATUS_STYLES = {
  Filed: 'bg-blue-50 text-blue-700 border-blue-200',
  Assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'In Review': 'bg-amber-50 text-amber-700 border-amber-200',
  'In Progress': 'bg-purple-50 text-purple-700 border-purple-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Escalated: 'bg-rose-50 text-rose-700 border-rose-200',
  Rejected: 'bg-stone-100 text-stone-600 border-stone-200',
};

const STATUS_ICONS = {
  Filed: 'fa-file-lines text-blue-600',
  Assigned: 'fa-user-check text-indigo-600',
  'In Review': 'fa-hourglass-half text-amber-600',
  'In Progress': 'fa-spinner text-purple-600',
  Resolved: 'fa-circle-check text-emerald-600',
  Escalated: 'fa-triangle-exclamation text-rose-600',
  Rejected: 'fa-circle-xmark text-stone-500',
};

const PRIORITY_STYLES = {
  Urgent: 'bg-rose-100 text-rose-800 border-rose-300',
  High: 'bg-amber-100 text-amber-800 border-amber-300',
  Medium: 'bg-blue-100 text-blue-800 border-blue-300',
  Low: 'bg-stone-100 text-stone-700 border-stone-300',
  Standard: 'bg-stone-100 text-stone-700 border-stone-300',
};

const STATUS_FILTER_OPTIONS = [
  { label: 'All Statuses', value: 'All' },
  { label: 'Pending / In Review', value: 'Pending' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Resolved', value: 'Resolved' },
  { label: 'Escalated', value: 'Escalated' },
  { label: 'Rejected', value: 'Rejected' },
];

export default function MyPetitions() {
  const navigate = useNavigate();

  // State
  const [petitions, setPetitions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  // Filters & Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, totalPages: 1 });

  // Summary Metrics
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });

  // Modal Detail State
  const [activePetition, setActivePetition] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch Categories on Mount
  useEffect(() => {
    let isMounted = true;
    complaintApi
      .getCategories()
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data || res.data?.categories || [];
        if (Array.isArray(list)) {
          setCategories(list);
        }
      })
      .catch((err) => {
        console.warn('Could not load categories:', err.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Petitions from Backend API
  const fetchPetitions = useCallback(async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        limit,
        sort: sortBy,
      };

      if (selectedStatus !== 'All') {
        params.status = selectedStatus;
      }
      if (selectedCategory !== 'All') {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await complaintApi.getMyComplaints(params);
      const rawData = res.data?.data || [];
      const pagination = res.data?.pagination || { total: rawData.length, totalPages: 1, page: 1, limit: 10 };
      const serverSummary = res.data?.summary;

      setPetitions(rawData);
      setPaginationInfo({
        total: pagination.total ?? rawData.length,
        totalPages: Math.max(1, pagination.totalPages ?? 1),
      });

      if (serverSummary) {
        setSummary({
          total: serverSummary.total ?? pagination.total,
          pending: serverSummary.pending ?? 0,
          inProgress: serverSummary.inProgress ?? 0,
          resolved: serverSummary.resolved ?? 0,
        });
      } else {
        // Fallback calculation from dataset
        const pending = rawData.filter((p) =>
          ['Filed', 'Assigned', 'In Review'].includes(p.status)
        ).length;
        const inProgress = rawData.filter((p) => p.status === 'In Progress').length;
        const resolved = rawData.filter((p) => p.status === 'Resolved').length;
        setSummary({
          total: pagination.total ?? rawData.length,
          pending,
          inProgress,
          resolved,
        });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
        return;
      }
      console.error('Error fetching user petitions:', err);
      setError(
        err.response?.data?.message || 'Failed to load your petitions. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, selectedStatus, selectedCategory, searchQuery, navigate]);

  // Trigger fetch when query parameters change
  useEffect(() => {
    fetchPetitions();
  }, [fetchPetitions]);

  // Reset page to 1 when filters or search change
  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('All');
    setSelectedCategory('All');
    setSortBy('newest');
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedStatus !== 'All' ||
    selectedCategory !== 'All' ||
    sortBy !== 'newest';

  const copyToClipboard = (text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      className="text-stone-800 flex h-dvh w-full overflow-hidden antialiased bg-[#FAF7F2]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* USER SIDEBAR (Strictly 5 items) */}
      <UserSidebar
        navOpen={navOpen}
        setNavOpen={setNavOpen}
        unreadCount={summary.pending}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-4 md:px-8 flex items-center justify-between shrink-0 shadow-sm gap-2">
          <div className="flex items-center min-w-0">
            <MobileNavToggle onClick={() => setNavOpen(true)} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-base md:text-lg font-bold text-stone-800 truncate">
                  My Petitions
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#6B1724]/10 text-[#6B1724] border border-[#6B1724]/20 hidden sm:inline-block">
                  {summary.total} {summary.total === 1 ? 'Petition' : 'Petitions'}
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block truncate">
                Track and manage the complaints you have submitted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/file-complaint"
              className="px-3.5 sm:px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5 shrink-0"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
              <span>File New Petition</span>
            </Link>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Petitions */}
            <div
              onClick={() => handleStatusChange('All')}
              className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between transition cursor-pointer group ${
                selectedStatus === 'All'
                  ? 'border-[#6B1724] ring-2 ring-[#6B1724]/10'
                  : 'border-stone-200/80 hover:border-[#6B1724]/40 hover:shadow-md'
              }`}
            >
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Total Petitions
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-stone-800 mt-1 group-hover:text-[#6B1724] transition">
                  {summary.total}
                </h3>
                <p className="text-[10px] text-stone-500 font-semibold mt-1">
                  All filed complaints
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center text-lg sm:text-xl shrink-0">
                <i className="fa-solid fa-folder-closed"></i>
              </div>
            </div>

            {/* Pending Petitions */}
            <div
              onClick={() => handleStatusChange('Pending')}
              className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between transition cursor-pointer group ${
                selectedStatus === 'Pending'
                  ? 'border-amber-500 ring-2 ring-amber-500/10'
                  : 'border-stone-200/80 hover:border-amber-400 hover:shadow-md'
              }`}
            >
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Pending Petitions
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
                  {summary.pending}
                </h3>
                <p className="text-[10px] text-amber-700 font-semibold mt-1">
                  Awaiting review / assign
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100/50 text-amber-800 flex items-center justify-center text-lg sm:text-xl shrink-0">
                <i className="fa-solid fa-hourglass-half"></i>
              </div>
            </div>

            {/* In Progress */}
            <div
              onClick={() => handleStatusChange('In Progress')}
              className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between transition cursor-pointer group ${
                selectedStatus === 'In Progress'
                  ? 'border-purple-500 ring-2 ring-purple-500/10'
                  : 'border-stone-200/80 hover:border-purple-400 hover:shadow-md'
              }`}
            >
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  In Progress
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-purple-600 mt-1">
                  {summary.inProgress}
                </h3>
                <p className="text-[10px] text-purple-700 font-semibold mt-1">
                  Active redressal
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-lg sm:text-xl shrink-0">
                <i className="fa-solid fa-spinner"></i>
              </div>
            </div>

            {/* Resolved */}
            <div
              onClick={() => handleStatusChange('Resolved')}
              className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between transition cursor-pointer group ${
                selectedStatus === 'Resolved'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                  : 'border-stone-200/80 hover:border-emerald-400 hover:shadow-md'
              }`}
            >
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Resolved
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1">
                  {summary.resolved}
                </h3>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <i className="fa-solid fa-circle-check text-[8px]"></i> Redressed
                </p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg sm:text-xl shrink-0">
                <i className="fa-solid fa-circle-check"></i>
              </div>
            </div>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-rose-600 text-sm"></i>
                <span>{error}</span>
              </div>
              <button
                onClick={fetchPetitions}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition text-xs shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* SEARCH, FILTERS, AND SORTING TOOLBAR */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Search by Petition ID, Title, or Description..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-[#6B1724] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    aria-label="Clear search"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {/* Filters & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Dropdown */}
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="px-3 py-2 bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6B1724] transition"
                >
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  className="px-3 py-2 bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6B1724] transition"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    title="Reset all search and filter conditions"
                  >
                    <i className="fa-solid fa-rotate-left text-[10px]"></i>
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-100">
              <span className="text-[11px] font-bold text-stone-400 mr-1 uppercase tracking-wider">
                Status:
              </span>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatus === opt.value
                      ? 'bg-[#6B1724] text-white shadow-xs'
                      : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* PETITION LIST SECTION */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
            {/* TABLE VIEW FOR DESKTOP / TABLET */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#FAF5EE] border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Petition ID</th>
                    <th className="py-3.5 px-4">Title & Subject</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Submitted</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {/* LOADING SKELETON */}
                  {loading && (
                    <>
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="py-4 px-5">
                            <div className="h-4 bg-stone-200 rounded w-24 mb-1"></div>
                            <div className="h-3 bg-stone-100 rounded w-16"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-stone-200 rounded w-48 mb-1"></div>
                            <div className="h-3 bg-stone-100 rounded w-32"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-stone-200 rounded w-16"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-stone-100 rounded w-20"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-5 bg-stone-200 rounded-full w-20"></div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-stone-100 rounded w-24"></div>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="h-7 bg-stone-200 rounded-lg w-16 ml-auto"></div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* LOADED PETITIONS */}
                  {!loading &&
                    petitions.map((p) => {
                      const cid = p.complaintId || p.id;
                      const status = p.status || 'Filed';
                      const badgeClass =
                        STATUS_STYLES[status] || 'bg-stone-100 text-stone-700 border-stone-200';
                      const iconClass = STATUS_ICONS[status] || 'fa-circle-dot text-stone-500';

                      return (
                        <tr
                          key={cid}
                          className="hover:bg-stone-50/80 transition cursor-pointer"
                          onClick={() => setActivePetition(p)}
                        >
                          {/* ID & Chain Badge */}
                          <td className="py-3.5 px-5 font-mono font-bold text-[#6B1724]">
                            <div className="flex flex-col items-start gap-1">
                              <span className="hover:underline">{cid}</span>
                              {p.chainId && (
                                <span
                                  className="inline-flex items-center gap-1 text-[9px] font-sans font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded"
                                  title={`Linked to Immutable Hash-Chain (Root: ${p.chainRoot || cid})`}
                                >
                                  <i className="fa-solid fa-link text-[8px]"></i> Chained
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Title */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 truncate">
                                {p.isAnonymous && (
                                  <span
                                    title="Anonymous Docket - Submitter Identity Sealed"
                                    className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[9px] font-bold shrink-0 flex items-center gap-1"
                                  >
                                    <i className="fa-solid fa-user-secret"></i> Anon
                                  </span>
                                )}
                                <span className="font-semibold text-stone-800 truncate" title={p.title}>
                                  {p.title}
                                </span>
                              </div>
                              {p.description && (
                                <p className="text-[11px] text-stone-400 truncate mt-0.5" title={p.description}>
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-stone-700">{p.category || 'General'}</span>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4 text-stone-500">
                            {p.department || p.assignedDesignation || '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeClass}`}
                            >
                              <i className={`fa-solid ${iconClass} text-[9px]`}></i>
                              <span>
                                {status}
                                {p.currentEscalationLevel && p.currentEscalationLevel > 1
                                  ? ` (L${p.currentEscalationLevel})`
                                  : ''}
                              </span>
                            </span>
                          </td>

                          {/* Submission Date */}
                          <td className="py-3.5 px-4 text-stone-500 font-mono text-[11px]">
                            {formatDate(p.createdAt)}
                          </td>

                          {/* Actions */}
                          <td
                            className="py-3.5 px-5 text-right space-x-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setActivePetition(p)}
                              className="px-2.5 py-1 bg-stone-100 hover:bg-[#6B1724] hover:text-white text-stone-700 rounded-lg text-xs font-semibold transition"
                              title="Inspect full details"
                            >
                              Details
                            </button>
                            <Link
                              to={`/petition-detail?id=${encodeURIComponent(cid)}`}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                              title="View Status Timeline"
                            >
                              <i className="fa-solid fa-clock-rotate-left text-[10px]"></i> Timeline
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                  {/* NO PETITIONS FOUND (FILTERED OR EMPTY) */}
                  {!loading && petitions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-16 text-center text-stone-400">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto px-4">
                          <div className="w-14 h-14 rounded-2xl bg-[#FAF5EE] border border-stone-200 flex items-center justify-center text-2xl text-[#6B1724] mb-1">
                            <i className="fa-solid fa-folder-open"></i>
                          </div>

                          {hasActiveFilters ? (
                            <>
                              <h3 className="font-bold text-sm text-stone-700">
                                No Matching Petitions Found
                              </h3>
                              <p className="text-xs text-stone-400 leading-relaxed">
                                No petitions match your active search or filter criteria. Try clearing
                                your filters or searching for something else.
                              </p>
                              <button
                                onClick={clearFilters}
                                className="mt-3 px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-rotate-left text-[10px]"></i>
                                <span>Reset Filters</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <h3 className="font-bold text-sm text-stone-700">
                                No Petitions Submitted Yet
                              </h3>
                              <p className="text-xs text-stone-400 leading-relaxed">
                                You have not submitted any complaints or petitions yet. File your first
                                petition to track its resolution transparently.
                              </p>
                              <Link
                                to="/file-complaint"
                                className="mt-3 px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-plus text-[10px]"></i>
                                <span>File a Complaint</span>
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION BAR */}
            {!loading && petitions.length > 0 && (
              <div className="p-4 bg-[#FAF5EE] border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <span>
                    Showing <strong className="text-stone-800">{(page - 1) * limit + 1}</strong> to{' '}
                    <strong className="text-stone-800">
                      {Math.min(page * limit, paginationInfo.total)}
                    </strong>{' '}
                    of <strong className="text-stone-800">{paginationInfo.total}</strong> petitions
                  </span>
                  <div className="hidden sm:flex items-center gap-1 ml-3 pl-3 border-l border-stone-300">
                    <span className="text-[11px] text-stone-500">Per page:</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition"
                  >
                    <i className="fa-solid fa-chevron-left mr-1 text-[10px]"></i> Prev
                  </button>

                  <span className="px-3 py-1 font-bold text-stone-700">
                    Page {page} of {paginationInfo.totalPages}
                  </span>

                  <button
                    onClick={() => setPage((prev) => Math.min(paginationInfo.totalPages, prev + 1))}
                    disabled={page >= paginationInfo.totalPages}
                    className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition"
                  >
                    Next <i className="fa-solid fa-chevron-right ml-1 text-[10px]"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* PETITION DETAILS MODAL */}
      {activePetition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FAF5EE] border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#6B1724]/10 text-[#6B1724] flex items-center justify-center text-base">
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#6B1724]">
                      {activePetition.complaintId || activePetition.id}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(activePetition.complaintId || activePetition.id)
                      }
                      className="text-stone-400 hover:text-stone-600 text-xs"
                      title="Copy Petition ID"
                    >
                      <i className={`fa-solid ${copiedId ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500">Submitted Petition Details</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_STYLES[activePetition.status] ||
                    'bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  {activePetition.status || 'Filed'}
                </span>
                <button
                  onClick={() => setActivePetition(null)}
                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition"
                  aria-label="Close dialog"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Title & Description */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {activePetition.isAnonymous && (
                    <span className="px-2 py-0.5 rounded bg-stone-200 text-stone-700 text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-user-secret"></i> Anonymous Docket
                    </span>
                  )}
                  {activePetition.priority && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        PRIORITY_STYLES[activePetition.priority] ||
                        'bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {activePetition.priority} Priority
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-stone-900">{activePetition.title}</h2>
                <div className="mt-3 p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 whitespace-pre-wrap leading-relaxed">
                  {activePetition.description}
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Category
                  </span>
                  <span className="font-semibold text-stone-800 text-xs mt-0.5 block">
                    {activePetition.category || 'General'}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Department
                  </span>
                  <span className="font-semibold text-stone-800 text-xs mt-0.5 block">
                    {activePetition.department || activePetition.assignedDesignation || 'Pending Assignment'}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Submitted Date
                  </span>
                  <span className="font-semibold text-stone-800 text-xs mt-0.5 block">
                    {formatDateTime(activePetition.createdAt)}
                  </span>
                </div>

                {activePetition.updatedAt && (
                  <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Last Updated
                    </span>
                    <span className="font-semibold text-stone-800 text-xs mt-0.5 block">
                      {formatDateTime(activePetition.updatedAt)}
                    </span>
                  </div>
                )}

                <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Escalation Level
                  </span>
                  <span className="font-semibold text-stone-800 text-xs mt-0.5 block">
                    Level {activePetition.currentEscalationLevel || 1}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Resolution Deadline
                  </span>
                  <span className="font-semibold text-stone-800 text-xs mt-0.5 block font-mono">
                    {formatDateTime(activePetition.resolutionDeadline || activePetition.slaDueAt)}
                  </span>
                </div>

                {activePetition.assignedOfficer && (
                  <div className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200/80 col-span-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Assigned Officer
                    </span>
                    <span className="font-semibold text-stone-800 text-xs mt-0.5 block">
                      {activePetition.assignedOfficer.fullName} (
                      {activePetition.assignedOfficer.designation || 'Officer'})
                    </span>
                  </div>
                )}
              </div>

              {/* Escalation History Log */}
              {activePetition.escalationHistory && activePetition.escalationHistory.length > 0 && (
                <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-bold">
                    <i className="fa-solid fa-arrow-up-right-dots text-rose-600"></i>
                    <span>Automatic Escalation History</span>
                  </div>
                  <div className="space-y-1.5">
                    {activePetition.escalationHistory.map((h, i) => (
                      <div
                        key={i}
                        className="p-2 bg-white rounded-lg border border-rose-100 text-[11px]"
                      >
                        <div className="flex justify-between font-semibold text-stone-800">
                          <span>
                            Level {h.previousLevel} → Level {h.newLevel}
                          </span>
                          <span className="font-mono text-[10px] text-stone-400">
                            {formatDateTime(h.escalatedAt)}
                          </span>
                        </div>
                        <p className="text-stone-600 text-[10px] mt-0.5">
                          {h.previousAssignedDesignation || 'Field Desk'} →{' '}
                          {h.newAssignedDesignation || 'Higher Authority'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cryptographic Hash-Chain Verification */}
              {activePetition.chainId && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold mb-1">
                    <i className="fa-solid fa-shield-halved text-indigo-600"></i>
                    <span>Tamper-Evident Hash Chain Verified</span>
                  </div>
                  <p className="text-[11px] text-indigo-700 leading-normal">
                    This grievance is cryptographically sealed into NyayaStack's audit ledger.
                  </p>
                  <div className="mt-2 font-mono text-[10px] text-indigo-900 break-all space-y-0.5">
                    <div>
                      <span className="text-indigo-400">Chain ID:</span> {activePetition.chainId}
                    </div>
                    {activePetition.chainRoot && (
                      <div>
                        <span className="text-indigo-400">Root ID:</span> {activePetition.chainRoot}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              <div>
                <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-paperclip text-stone-500"></i>
                  <span>Attachments</span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    ({activePetition.attachments?.length || 0})
                  </span>
                </h3>

                {activePetition.attachments && activePetition.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePetition.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-2.5 transition group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:text-[#6B1724]">
                          <i className="fa-solid fa-file text-sm"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-stone-800 truncate text-[11px]">
                            {att.publicId || `Document ${i + 1}`}
                          </p>
                          <p className="text-[10px] text-stone-400 uppercase">
                            {att.format || att.resourceType || 'File'}
                          </p>
                        </div>
                        <i className="fa-solid fa-arrow-up-right-from-square text-stone-400 group-hover:text-stone-700 text-[10px] mr-1"></i>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400 italic bg-stone-50 p-3 rounded-xl border border-stone-200">
                    No attachments uploaded with this petition.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#FAF5EE] border-t border-stone-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setActivePetition(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold rounded-xl text-xs transition"
              >
                Close
              </button>
              <Link
                to={`/petition-detail?id=${encodeURIComponent(
                  activePetition.complaintId || activePetition.id
                )}`}
                className="px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white font-semibold rounded-xl text-xs shadow transition inline-flex items-center gap-1.5"
              >
                <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                <span>View Status Timeline</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
