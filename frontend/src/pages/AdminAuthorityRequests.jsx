import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";
import { adminApi } from "../services/api";

const DEPARTMENTS = [
  "All Departments",
  "Academic Affairs",
  "Hostel & Mess",
  "Examination Cell",
  "Anti-Ragging Committee",
  "Internal Complaints Committee",
  "Library",
  "IT & Infrastructure",
  "Administration",
];

export default function AdminAuthorityRequests() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'approved' | 'rejected' | 'all'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // Detail Modal
  const [detailApplicant, setDetailApplicant] = useState(null);

  // Reject Modal
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

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (activeTab !== "all") {
        params.status = activeTab;
      }
      if (selectedDept !== "All Departments") {
        params.department = selectedDept;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await adminApi.getAuthorityRequests(params);
      setRequests(res.data?.data || []);
      if (res.data?.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error("Error fetching authority requests:", err);
      setError(
        err.response?.data?.message || "Failed to load authority applications."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab, selectedDept]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleApprove = async (id, applicantName) => {
    if (!window.confirm(`Are you sure you want to approve authority credentials for ${applicantName}?`)) {
      return;
    }
    try {
      setActionLoading(id);
      await adminApi.approveAuthorityRequest(id);
      await fetchRequests();
      if (detailApplicant && detailApplicant.id === id) {
        setDetailApplicant(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve application");
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
      await fetchRequests();
      if (detailApplicant && detailApplicant.id === rejectModal.requestId) {
        setDetailApplicant(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject application");
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
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-200/60 transition"
            >
              <i className="fa-solid fa-shield-halved w-4"></i> Admin Console
            </Link>

            <Link
              to="/admin/authority-requests"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"
            >
              <span className="flex items-center gap-2.5">
                <i className="fa-solid fa-user-check w-4"></i> Authority Requests
              </span>
              {counts.pending > 0 && (
                <span className="bg-amber-400 text-stone-900 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {counts.pending}
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
              <i className="fa-solid fa-chart-column w-4"></i> Analytics & Trends
            </Link>

            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <Link
                to="/dashboard"
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-emerald-900 bg-emerald-100/50 hover:bg-emerald-100 transition text-[11px]"
              >
                <i className="fa-solid fa-user-graduate w-4 text-emerald-700"></i> Switch to Student View
              </Link>
            </div>
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
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-stone-400 font-semibold mb-0.5">
              <Link to="/admin/dashboard" className="hover:text-[#6B1724]">Admin Console</Link>
              <i className="fa-solid fa-chevron-right text-[9px]"></i>
              <span className="text-stone-700">Authority Verification Workqueue</span>
            </div>
            <h1 className="text-lg font-bold text-stone-800">Authority Requests Verification</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRequests}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-rotate-right"></i> Refresh
            </button>
          </div>
        </header>

        {/* WORKQUEUE BODY */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-red-600"></i>
                {error}
              </span>
              <button onClick={fetchRequests} className="underline font-semibold hover:text-red-900">
                Retry
              </button>
            </div>
          )}

          {/* STATUS TABS */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center bg-[#F0E8DC] p-1 rounded-xl border border-stone-200/80">
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === "pending"
                    ? "bg-[#6B1724] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <i className="fa-solid fa-clock"></i>
                Pending
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === "pending"
                      ? "bg-amber-400 text-stone-900"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {counts.pending}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("approved")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === "approved"
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <i className="fa-solid fa-circle-check"></i>
                Approved
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === "approved"
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {counts.approved}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("rejected")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === "rejected"
                    ? "bg-rose-800 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <i className="fa-solid fa-circle-xmark"></i>
                Rejected
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === "rejected"
                      ? "bg-rose-200 text-rose-900"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {counts.rejected}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === "all"
                    ? "bg-stone-800 text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                All Applications
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === "all"
                      ? "bg-stone-600 text-white"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {counts.total}
                </span>
              </button>
            </div>

            {/* FILTERS */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Search by name, email, employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-white border border-stone-200/80 rounded-xl text-xs outline-none focus:border-[#6B1724] w-64 shadow-2xs"
                />
              </div>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-3 py-2 bg-white border border-stone-200/80 rounded-xl text-xs outline-none focus:border-[#6B1724] shadow-2xs text-stone-700 font-medium"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-stone-400 text-xs">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#6B1724] mb-2 block"></i>
                Loading applications queue...
              </div>
            ) : requests.length === 0 ? (
              <div className="p-16 text-center text-stone-400 text-xs">
                <i className="fa-solid fa-clipboard-check text-3xl text-stone-300 mb-2 block"></i>
                No authority registration applications match the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF7F2] text-stone-600 font-bold border-b border-stone-200/80">
                      <th className="py-3.5 px-6">Official Identity</th>
                      <th className="py-3.5 px-4">Employee ID</th>
                      <th className="py-3.5 px-4">Department & Designation</th>
                      <th className="py-3.5 px-4">Submitted At</th>
                      <th className="py-3.5 px-4">Status & Review</th>
                      <th className="py-3.5 px-6 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-stone-50/80 transition">
                        <td className="py-4 px-6">
                          <div className="font-bold text-stone-900">{req.fullName}</div>
                          <div className="text-[11px] text-stone-400 font-mono">{req.email}</div>
                          <div className="text-[10px] text-stone-400 font-mono">@{req.username}</div>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-stone-700">
                          {req.employeeId || "—"}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 font-medium text-[11px] border border-stone-200 mb-1">
                            {req.department}
                          </span>
                          <div className="text-[11px] text-stone-500 font-medium">{req.designation}</div>
                        </td>
                        <td className="py-4 px-4 text-stone-500 font-mono text-[11px]">
                          {new Date(req.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          <div className="text-[10px] text-stone-400">
                            {new Date(req.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {req.verificationStatus === "approved" ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <i className="fa-solid fa-check text-[9px]"></i> Approved
                              </span>
                              {req.reviewedBy && (
                                <p className="text-[10px] text-stone-400 font-mono mt-1">
                                  by {req.reviewedBy.fullName || "Admin"}
                                </p>
                              )}
                            </div>
                          ) : req.verificationStatus === "rejected" ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                                title={req.rejectionReason}
                              >
                                <i className="fa-solid fa-xmark text-[9px]"></i> Rejected
                              </span>
                              {req.rejectionReason && (
                                <p className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={req.rejectionReason}>
                                  "{req.rejectionReason}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                              <i className="fa-solid fa-clock text-[9px]"></i> Pending Review
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => setDetailApplicant(req)}
                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-semibold text-[11px] transition"
                            title="Inspect application details"
                          >
                            <i className="fa-solid fa-eye mr-1"></i> Inspect
                          </button>

                          {req.verificationStatus !== "approved" && (
                            <button
                              disabled={actionLoading === req.id}
                              onClick={() => handleApprove(req.id, req.fullName)}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-[11px] transition shadow-2xs disabled:opacity-50"
                            >
                              {actionLoading === req.id ? "..." : "Approve"}
                            </button>
                          )}

                          {req.verificationStatus !== "rejected" && (
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
                              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-semibold text-[11px] transition shadow-2xs disabled:opacity-50"
                            >
                              Reject
                            </button>
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

      {/* INSPECT DETAIL MODAL */}
      {detailApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[#FAF7F2] rounded-2xl max-w-lg w-full border border-stone-300 shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-stone-200/80 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#6B1724] text-white flex items-center justify-center font-bold text-sm">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base">Authority Credential Details</h3>
                  <p className="text-[11px] text-stone-500 font-mono">ID: {detailApplicant.id}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailApplicant(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-stone-200/80">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Full Name</span>
                  <p className="font-bold text-stone-800 text-sm mt-0.5">{detailApplicant.fullName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Official Email</span>
                  <p className="font-mono text-stone-800 mt-0.5">{detailApplicant.email}</p>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Employee ID</span>
                  <p className="font-mono font-bold text-stone-900 mt-0.5">{detailApplicant.employeeId || "Not Provided"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Username</span>
                  <p className="font-mono text-stone-600 mt-0.5">@{detailApplicant.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-stone-200/80">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Assigned Department</span>
                  <p className="font-semibold text-stone-800 mt-0.5">{detailApplicant.department}</p>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Designation</span>
                  <p className="font-semibold text-stone-800 mt-0.5">{detailApplicant.designation}</p>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Application Date</span>
                  <p className="text-stone-700 mt-0.5">{new Date(detailApplicant.createdAt).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-semibold">Current Verification Status</span>
                  <div className="mt-0.5">
                    {detailApplicant.verificationStatus === "approved" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Approved
                      </span>
                    ) : detailApplicant.verificationStatus === "rejected" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Rejected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Pending Verification
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {detailApplicant.reviewedBy && (
                <div className="bg-stone-100/70 p-3.5 rounded-xl border border-stone-200 text-stone-600">
                  <span className="text-[10px] text-stone-400 uppercase font-semibold block mb-1">
                    Audit Review Record
                  </span>
                  <p className="font-medium">
                    Reviewed by <strong className="text-stone-800">{detailApplicant.reviewedBy.fullName || "Admin"}</strong> on{" "}
                    {detailApplicant.reviewedAt ? new Date(detailApplicant.reviewedAt).toLocaleString("en-IN") : "N/A"}
                  </p>
                  {detailApplicant.rejectionReason && (
                    <p className="text-rose-700 mt-1 text-[11px]">
                      Reason: {detailApplicant.rejectionReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-5 border-t border-stone-200/80 mt-5">
              <button
                onClick={() => setDetailApplicant(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
              {detailApplicant.verificationStatus !== "approved" && (
                <button
                  disabled={actionLoading === detailApplicant.id}
                  onClick={() => handleApprove(detailApplicant.id, detailApplicant.fullName)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
                >
                  Approve Application
                </button>
              )}
              {detailApplicant.verificationStatus !== "rejected" && (
                <button
                  disabled={actionLoading === detailApplicant.id}
                  onClick={() => {
                    const applicant = detailApplicant;
                    setDetailApplicant(null);
                    setRejectModal({
                      isOpen: true,
                      requestId: applicant.id,
                      applicantName: applicant.fullName,
                      reason: "",
                    });
                  }}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
                >
                  Reject Application
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
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
                  Rejection Reason (Will be displayed to applicant upon login attempt)
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectModal.reason}
                  onChange={(e) =>
                    setRejectModal({ ...rejectModal, reason: e.target.value })
                  }
                  placeholder="e.g. Employee ID could not be matched with institutional roster."
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
