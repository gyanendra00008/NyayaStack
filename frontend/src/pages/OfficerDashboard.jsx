import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { complaintApi, authApi } from "../services/api";
import OfficerSidebar from "../components/OfficerSidebar";

const STATUS_BADGES = {
  Filed: "bg-blue-50 text-blue-700 border-blue-200",
  Assigned: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "In Review": "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-purple-50 text-purple-700 border-purple-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Escalated: "bg-rose-100 text-rose-800 border-rose-300",
  Rejected: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [officerProfile, setOfficerProfile] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    escalated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  // Fetch officer profile and assigned grievances
  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch authenticated user profile
      try {
        const meRes = await authApi.getMe();
        if (meRes.data?.user) {
          setOfficerProfile(meRes.data.user);
        }
      } catch (err) {
        // quiet fallback
      }

      // 2. Fetch complaints assigned to this officer / lowest rank authority
      const res = await complaintApi.getAssignedComplaints({ limit: 50 });
      if (res.data?.success) {
        setComplaints(res.data.data || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err) {
      console.error("Failed to load officer dashboard:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load assigned grievances. Please try refreshing."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authorityToken");
    sessionStorage.removeItem("authorityToken");
    localStorage.removeItem("nyaya_logged_user");
    localStorage.removeItem("nyaya_user_name");
    localStorage.removeItem("nyaya_user_role");
    sessionStorage.clear();
    dispatch(logout());
    navigate("/authority/login");
  };

  const handleQuickStatusChange = async (complaintId, nextStatus) => {
    try {
      setUpdatingId(complaintId);
      await complaintApi.updateComplaintStatus(complaintId, { status: nextStatus });
      await loadData();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          `Failed to update status to ${nextStatus}. Please try again.`
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const officerName =
    officerProfile?.fullName ||
    localStorage.getItem("nyaya_user_name") ||
    "Authority Officer";
  const officerDepartment = officerProfile?.department || "General";
  const officerDesignation = officerProfile?.designation || "Officer";
  const officerCategory = officerProfile?.category || "All Categories";
  const officerRank = officerProfile?.rank;

  const officerInitials =
    officerName
      .split(/[\s_.-]+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AO";

  // Filter complaints based on statusFilter and searchQuery
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesStatus =
        statusFilter === "All"
          ? true
          : statusFilter === "Pending"
          ? ["Filed", "Assigned", "In Review", "In Progress"].includes(c.status)
          : c.status === statusFilter;

      if (!matchesStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const idMatch = (c.complaintId || "").toLowerCase().includes(q);
        const titleMatch = (c.title || "").toLowerCase().includes(q);
        const descMatch = (c.description || "").toLowerCase().includes(q);
        const catMatch = (c.category || "").toLowerCase().includes(q);
        return idMatch || titleMatch || descMatch || catMatch;
      }

      return true;
    });
  }, [complaints, statusFilter, searchQuery]);

  return (
    <div
      className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* SIDEBAR */}
      {/* SIDEBAR */}
<OfficerSidebar
  name={officerName}
  designation={officerDesignation}
  initials={officerInitials}
  onLogout={handleLogout}
/>

      {/* MAIN CONTENT */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-stone-800">
              Officer Redressal Console
            </h1>
            <p className="text-xs text-stone-500">
              Department of {officerDepartment} • {officerDesignation}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChangePassword(true)}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-key text-[10px] text-[#7a1620]"></i> Change
              Password
            </button>
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>{" "}
              Lowest-Rank Redressal Active
            </span>
          </div>
        </header>

        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                <span>{error}</span>
              </div>
              <button
                onClick={loadData}
                className="underline hover:text-rose-950 font-bold ml-4"
              >
                Retry
              </button>
            </div>
          )}

          {/* Informational routing banner */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-[#7a1620] flex items-center justify-center font-bold text-base shrink-0">
                <i className="fa-solid fa-sitemap"></i>
              </div>
              <div>
                <p className="font-bold text-sm text-[#7a1620]">
                  Direct Redressal Routing: Lowest-Rank Authority Desk
                </p>
                <p className="text-stone-600 text-[11px] mt-0.5">
                  Institutional grievances filed in <strong>{officerDepartment}</strong> (focus:{" "}
                  <strong>{officerCategory}</strong>) route immediately to your desk (
                  <strong>{officerDesignation}</strong>) for first-line resolution before any escalation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-amber-200/60 font-mono text-[11px] font-bold text-amber-900">
                Rank Level: {officerRank || "Field Desk"}
              </span>
              <button
                onClick={loadData}
                className="p-1.5 rounded-lg bg-white border border-amber-300 text-stone-600 hover:text-[#7a1620] transition"
                title="Refresh Workqueue"
              >
                <i className={`fa-solid fa-rotate-right text-xs ${loading ? "fa-spin" : ""}`}></i>
              </button>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase">
                  Assigned to Me
                </p>
                <h3 className="text-2xl font-extrabold mt-1">{counts.total}</h3>
                <p className="text-[10px] text-stone-400 mt-1">Direct Redressal Desk</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center text-xl">
                <i className="fa-solid fa-inbox"></i>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase">
                  Active / In Progress
                </p>
                <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
                  {counts.pending}
                </h3>
                <p className="text-[10px] text-amber-600 font-semibold mt-1">
                  SLA Active Oversight
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl">
                <i className="fa-solid fa-clock"></i>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase">
                  Resolved
                </p>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {counts.resolved}
                </h3>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                  Grievances Closed
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl">
                <i className="fa-solid fa-circle-check"></i>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase">
                  Escalated
                </p>
                <h3 className="text-2xl font-extrabold text-rose-600 mt-1">
                  {counts.escalated}
                </h3>
                <p className="text-[10px] text-stone-400 mt-1">Ombudsman / Head</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center text-xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
            </div>
          </div>

          {/* COMPLAINTS WORKQUEUE */}
          <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-stone-800">
                  Assigned Grievances Workqueue ({filteredComplaints.length})
                </h2>
                <p className="text-xs text-stone-400">
                  Routed to you based on your category and lowest-rank authority designation
                </p>
              </div>

              {/* Status and Search Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID or title..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:border-[#6B1724]"
                  />
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                </div>

                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs">
                  {["All", "Pending", "In Progress", "Resolved"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        statusFilter === s
                          ? "bg-white text-[#6B1724] shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-stone-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Petition ID</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Filed On</th>
                    <th className="py-2.5 px-3">Quick Actions</th>
                    <th className="py-2.5 px-3 text-right">Docket</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-stone-700">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-stone-400">
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i> Loading
                        assigned grievances...
                      </td>
                    </tr>
                  ) : filteredComplaints.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-stone-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <i className="fa-solid fa-inbox text-3xl text-stone-300"></i>
                          <p className="font-semibold text-sm text-stone-600">
                            No Grievances in this View
                          </p>
                          <p className="text-xs text-stone-400 max-w-sm text-center">
                            When users submit grievances in <strong>{officerDepartment}</strong> (
                            {officerCategory}), they will automatically be routed directly to your desk.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredComplaints.map((c) => (
                      <tr key={c.complaintId} className="hover:bg-stone-50 transition">
                        <td className="py-3 px-3 font-mono font-bold text-[#6B1724]">
                          <span>{c.complaintId}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold text-[10px]">
                            {c.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate" title={c.title}>
                          <div className="flex items-center gap-1.5 truncate">
                            {c.isAnonymous && (
                              <span
                                title="Anonymous Submission"
                                className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[9px] font-bold shrink-0"
                              >
                                <i className="fa-solid fa-user-secret mr-1"></i>Anon
                              </span>
                            )}
                            <span className="truncate">{c.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              STATUS_BADGES[c.status] || "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Recent"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            {c.status !== "In Progress" && c.status !== "Resolved" && (
                              <button
                                disabled={updatingId === c.complaintId}
                                onClick={() => handleQuickStatusChange(c.complaintId, "In Progress")}
                                className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[10px] font-semibold transition"
                              >
                                Start Work
                              </button>
                            )}
                            {c.status !== "Resolved" && (
                              <button
                                disabled={updatingId === c.complaintId}
                                onClick={() => handleQuickStatusChange(c.complaintId, "Resolved")}
                                className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-semibold transition"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            to={`/petition-detail?id=${encodeURIComponent(c.complaintId)}`}
                            className="px-3 py-1 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-lg font-semibold shadow-xs transition inline-block text-[11px]"
                          >
                            Open Docket
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
