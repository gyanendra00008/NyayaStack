import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";
import { adminApi } from "../services/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // Reject modal state
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    requestId: null,
    applicantName: "",
    reason: "",
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authorityToken");
    sessionStorage.removeItem("authorityToken");
    localStorage.removeItem("nyaya_logged_user");
    localStorage.removeItem("nyaya_user_name");
    localStorage.removeItem("nyaya_user_role");
    localStorage.removeItem("nyaya_verification_status");
    sessionStorage.clear();
    dispatch(logout());
    navigate("/authority/login");
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [statsRes, requestsRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getAuthorityRequests({ status: "all" }),
      ]);

      if (statsRes.data?.stats?.authorityRequests) {
        setStats(statsRes.data.stats.authorityRequests);
      } else if (requestsRes.data?.counts) {
        setStats(requestsRes.data.counts);
      }

      setRecentRequests(requestsRes.data?.data || []);
    } catch (err) {
      console.error("Failed to load admin dashboard data:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load administrative records. Please check your network or credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id, applicantName) => {
    if (!window.confirm(`Approve official authority account for ${applicantName}?`)) {
      return;
    }
    try {
      setActionLoading(id);
      await adminApi.approveAuthorityRequest(id);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve authority request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModal.requestId) return;

    try {
      setActionLoading(rejectModal.requestId);
      await adminApi.rejectAuthorityRequest(rejectModal.requestId, rejectModal.reason);
      setRejectModal({ isOpen: false, requestId: null, applicantName: "", reason: "" });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject authority request");
    } finally {
      setActionLoading(null);
    }
  };

  const rawName = localStorage.getItem("nyaya_user_name") || "Administrator";
  const adminName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const adminInitials =
    adminName
      .split(/[\s_.-]+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  return (
    <div
      className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* SIDEBAR */}
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <Link
            to="/"
            className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition"
          >
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span
              className="font-bold text-lg text-[#6B1724]"
              style={{ fontFamily: "Cinzel, serif" }}
            >
              NyayaStack
            </span>
          </Link>

          <nav className="p-4 space-y-1 text-xs font-semibold">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"
            >
              <i className="fa-solid fa-shield-halved w-4"></i> Admin Console
            </Link>

            <Link
              to="/admin/authority-requests"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-200/60 transition"
            >
              <span className="flex items-center gap-2.5">
                <i className="fa-solid fa-user-check w-4 text-[#6B1724]"></i> Authority Requests
              </span>
              {stats.pending > 0 && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {stats.pending}
                </span>
              )}
            </Link>

            <Link
              to="/officerdash"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"
            >
              <i className="fa-solid fa-gauge-high w-4"></i> Officer Console
            </Link>

            <Link
              to="/ledger"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"
            >
              <i className="fa-solid fa-fingerprint w-4 text-[#6B1724]"></i> Audit Ledger
            </Link>

            <Link
              to="/publictrans"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"
            >
              <i className="fa-solid fa-chart-column w-4"></i> Public Transparency
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {adminInitials}
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">{adminName}</p>
              <p className="text-[10px] text-amber-900 font-mono font-semibold">Institutional Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-stone-400 hover:text-[#6B1724] p-1.5 transition"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-xs">
          <div>
            <h1 className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <i className="fa-solid fa-building-columns text-[#6B1724]"></i>
              Institutional Administrator Console
            </h1>
            <p className="text-xs text-stone-500">
              Authority Credential Verification & Role Access Management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/authority-requests"
              className="px-3.5 py-1.5 bg-[#6B1724] hover:bg-[#52121c] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-list-check"></i>
              Review Requests ({stats.pending})
            </Link>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-red-600"></i>
                {error}
              </span>
              <button onClick={fetchData} className="underline font-semibold hover:text-red-900">
                Retry
              </button>
            </div>
          )}

          {/* PENDING NOTIFICATION BANNER */}
          {stats.pending > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-200 flex items-center justify-center text-xl shrink-0">
                  <i className="fa-solid fa-user-clock"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900">
                    {stats.pending} Authority Application{stats.pending > 1 ? "s" : ""} Awaiting Verification
                  </h3>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Faculty coordinators and committee officials have applied for authority privileges. Review credentials before granting access.
                  </p>
                </div>
              </div>
              <Link
                to="/admin/authority-requests"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold transition shrink-0 shadow-xs"
              >
                Inspect Queue
              </Link>
            </div>
          )}

          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-stone-500">Pending Approval</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                  <i className="fa-solid fa-hourglass-half text-sm"></i>
                </span>
              </div>
              <p className="text-2xl font-bold text-amber-800 mt-3">{stats.pending}</p>
              <p className="text-[11px] text-stone-400 mt-1">Requires admin verification</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-stone-500">Approved Authorities</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <i className="fa-solid fa-user-shield text-sm"></i>
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 mt-3">{stats.approved}</p>
              <p className="text-[11px] text-stone-400 mt-1">Active officers with access</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-stone-500">Rejected Applications</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60">
                  <i className="fa-solid fa-user-xmark text-sm"></i>
                </span>
              </div>
              <p className="text-2xl font-bold text-rose-700 mt-3">{stats.rejected}</p>
              <p className="text-[11px] text-stone-400 mt-1">Denied applications</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-stone-500">Total Applications</span>
                <span className="p-2 rounded-xl bg-stone-100 text-stone-700 border border-stone-200">
                  <i className="fa-solid fa-users text-sm"></i>
                </span>
              </div>
              <p className="text-2xl font-bold text-stone-800 mt-3">{stats.total}</p>
              <p className="text-[11px] text-stone-400 mt-1">Historical registrations</p>
            </div>
          </div>

          {/* RECENT APPLICATIONS TABLE */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-stone-200/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-800 text-sm">Recent Authority Applications</h3>
                <p className="text-xs text-stone-500">
                  Real-time registration audit of institutional authorities and officers
                </p>
              </div>
              <Link
                to="/admin/authority-requests"
                className="text-xs font-semibold text-[#6B1724] hover:underline flex items-center gap-1"
              >
                View all applications <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </Link>
            </div>

            {loading ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                <i className="fa-solid fa-circle-notch fa-spin text-xl text-[#6B1724] mb-2 block"></i>
                Loading authority records...
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                <i className="fa-solid fa-inbox text-2xl text-stone-300 mb-2 block"></i>
                No authority registration applications on record.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF7F2] text-stone-600 font-bold border-b border-stone-200/80">
                      <th className="py-3.5 px-6">Applicant Info</th>
                      <th className="py-3.5 px-4">Employee ID</th>
                      <th className="py-3.5 px-4">Department & Role</th>
                      <th className="py-3.5 px-4">Applied Date</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-6 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recentRequests.slice(0, 10).map((req) => (
                      <tr key={req.id} className="hover:bg-stone-50/80 transition">
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-stone-800">{req.fullName}</div>
                          <div className="text-[11px] text-stone-400 font-mono">{req.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-stone-700">
                          {req.employeeId || "—"}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-stone-800 font-medium">{req.department}</div>
                          <div className="text-[11px] text-stone-500">{req.designation}</div>
                        </td>
                        <td className="py-3.5 px-4 text-stone-500 font-mono text-[11px]">
                          {new Date(req.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          {req.verificationStatus === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <i className="fa-solid fa-check text-[9px]"></i> Approved
                            </span>
                          ) : req.verificationStatus === "rejected" ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                              title={req.rejectionReason}
                            >
                              <i className="fa-solid fa-xmark text-[9px]"></i> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                              <i className="fa-solid fa-clock text-[9px]"></i> Pending Review
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right space-x-1.5">
                          {req.verificationStatus === "pending" ? (
                            <>
                              <button
                                disabled={actionLoading === req.id}
                                onClick={() => handleApprove(req.id, req.fullName)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-[11px] transition shadow-2xs disabled:opacity-50"
                              >
                                {actionLoading === req.id ? "..." : "Approve"}
                              </button>
                              <button
                                disabled={actionLoading === req.id}
                                onClick={() =>
                                  setRejectModal({
                                    isOpen: true,
                                    requestId: req.id,
                                    applicantName: req.fullName,
                                    reason: "",
                                  })
                                }
                                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold text-[11px] transition shadow-2xs disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <Link
                              to="/admin/authority-requests"
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-semibold text-[11px] transition"
                            >
                              Details
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* REJECT MODAL */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#FAF7F2] rounded-2xl max-w-md w-full border border-stone-300 shadow-xl p-6">
            <div className="flex items-center gap-3 text-rose-800 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-base"></i>
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-base">Reject Authority Request</h3>
                <p className="text-xs text-stone-500">Applicant: {rejectModal.applicantName}</p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Rejection Reason (Displayed to applicant upon login attempt)
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectModal.reason}
                  onChange={(e) =>
                    setRejectModal({ ...rejectModal, reason: e.target.value })
                  }
                  placeholder="e.g. Employee ID could not be verified with institutional records."
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs outline-none focus:border-[#6B1724]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setRejectModal({ isOpen: false, requestId: null, applicantName: "", reason: "" })
                  }
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === rejectModal.requestId}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-60"
                >
                  {actionLoading === rejectModal.requestId ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
