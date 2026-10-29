import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import anonymousAvatar from '../assets/anonymous-avatar.svg';
import { complaintApi } from '../services/api';
import AppSidebar from '../components/AppSidebar';

const PetitionDetails = () => {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get('id') || '#NY-1048';

  const [complaintData, setComplaintData] = useState(null);
  const [slaSeconds, setSlaSeconds] = useState(5025);
  const isOfficer =
    localStorage.getItem('nyaya_user_role') === 'officer' ||
    localStorage.getItem('nyaya_user_role') === 'admin';
  const [statusUpdating, setStatusUpdating] = useState(false);

  const handleStatusChange = async (nextStatus) => {
    const cid = complaintData?.complaintId || queryId;
    if (!cid) return;
    setStatusUpdating(true);
    try {
      await complaintApi.updateComplaintStatus(cid, { status: nextStatus });
      setComplaintData((prev) => ({ ...prev, status: nextStatus }));
      alert(`Grievance status updated to "${nextStatus}"`);
    } catch (err) {
      alert(err.response?.data?.message || `Failed to update status to ${nextStatus}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  useEffect(() => {
    if (queryId) {
      complaintApi
        .getComplaintById(queryId)
        .then((res) => {
          if (res.data?.data) {
            setComplaintData(res.data.data);
            if (res.data.data.resolutionDeadline) {
              const diffMs = new Date(res.data.data.resolutionDeadline).getTime() - Date.now();
              setSlaSeconds(Math.max(0, Math.floor(diffMs / 1000)));
            }
          }
        })
        .catch(() => {
          // Check local storage fallback
          try {
            const list = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
            const found = list.find((p) => p.id === queryId || p.complaintId === queryId);
            if (found) {
              setComplaintData({
                complaintId: found.id || found.complaintId,
                title: found.subject || found.title,
                category: found.category,
                description: found.desc || found.description,
                status: found.status || 'Filed',
                attachments: found.attachments || [],
                createdAt: found.time || new Date().toISOString(),
                currentEscalationLevel: 1,
              });
            }
          } catch (e) {}
        });
    }
  }, [queryId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSla = (totalSeconds) => {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
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

  const currentStatus = complaintData?.status || 'Filed';
  const escalationLevel = complaintData?.currentEscalationLevel || 1;
  const isEscalated =
    complaintData?.status === 'Escalated' ||
    complaintData?.escalationStatus === 'escalated' ||
    complaintData?.escalationStatus === 'admin_attention';

  return (
    <div
      className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}
    >
      {/* ROLE SPECIFIC SIDEBAR */}
      <AppSidebar />

      {/* FULL SCREEN RIGHT CONTENT AREA */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              to="/my-petitions"
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-[#6B1724] hover:text-white flex items-center justify-center text-xs transition"
              title="Back to Petitions"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-stone-800 font-mono">
                  {complaintData?.complaintId || queryId}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isEscalated
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isEscalated ? `Escalated (Level ${escalationLevel})` : currentStatus}
                </span>
                {complaintData?.escalationStatus === 'admin_attention' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                    <i className="fa-solid fa-bell"></i> Admin Review Required
                  </span>
                )}
                {complaintData?.isAnonymous && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-700 flex items-center gap-1">
                    <i className="fa-solid fa-user-secret"></i> Anonymous Docket
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                {complaintData?.title || 'Assigned to Redressal Committee • SLA Monitored'}
              </p>
            </div>
          </div>
          <Link
            to="/ledger"
            className="px-3.5 py-1.5 bg-[#FAF5EE] hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-[#6B1724] transition flex items-center gap-1.5 shadow-sm"
          >
            <i className="fa-solid fa-fingerprint"></i> SHA-256 Ledger
          </Link>
        </header>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Top Row: Complaint Details & SLA Timer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h2 className="font-bold text-stone-800 text-sm">
                  {complaintData?.title ? complaintData.title : 'Complaint Details'}
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                  <i className="fa-solid fa-shield"></i> Merkle Verified
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF5EE] p-3 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-400 block text-[10px]">Category:</span>
                  <span className="font-bold text-stone-800">
                    {complaintData?.category || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Department:</span>
                  <span className="font-bold text-stone-800">
                    {complaintData?.department || 'Department Grievance Cell'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Current Authority:</span>
                  <span className="font-bold text-[#7a1620]">
                    {complaintData?.assignedDesignation
                      ? `${complaintData.assignedDesignation} (Level ${escalationLevel})`
                      : 'Initial Redressal Officer'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Resolution Deadline:</span>
                  <span className="font-bold text-stone-800 font-mono text-[11px]">
                    {formatDateTime(complaintData?.resolutionDeadline || complaintData?.slaDueAt)}
                  </span>
                </div>
              </div>

              {isOfficer && (
                <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                  <span className="text-[11px] font-bold text-stone-500">Authority Action:</span>
                  {complaintData?.status !== 'In Progress' && (
                    <button
                      disabled={statusUpdating}
                      onClick={() => handleStatusChange('In Progress')}
                      className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-semibold transition"
                    >
                      <i className="fa-solid fa-spinner mr-1"></i> Start Work / In Progress
                    </button>
                  )}
                  {complaintData?.status !== 'Resolved' && (
                    <button
                      disabled={statusUpdating}
                      onClick={() => handleStatusChange('Resolved')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition"
                    >
                      <i className="fa-solid fa-check mr-1"></i> Mark Resolved
                    </button>
                  )}
                </div>
              )}
              <div>
                <span className="text-stone-400 block text-[10px] mb-1">Description:</span>
                <p className="bg-[#FAF5EE] p-3.5 rounded-xl border border-stone-200 text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {complaintData?.description || 'Enter the description of the problem here.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-stone-400 text-[10px]">Attachments:</span>
                {complaintData?.attachments && complaintData.attachments.length > 0 ? (
                  complaintData.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-[11px] font-mono border border-stone-200 flex items-center gap-1 transition text-stone-800"
                    >
                      <i className="fa-solid fa-paperclip text-[#6B1724]"></i>
                      <span>{att.originalName || `Attachment-${idx + 1}`}</span>
                    </a>
                  ))
                ) : (
                  <span className="text-stone-400 italic text-[11px]">No external attachments</span>
                )}
              </div>
            </div>

            {/* SLA Escalation Window Timer */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between text-center">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Hierarchy SLA Window
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      isEscalated
                        ? 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse'
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                    }`}
                  >
                    Level {escalationLevel} • 48h Window
                  </span>
                </div>
                <div className="w-24 h-24 mx-auto my-2 rounded-full border-4 border-rose-100 border-t-[#6B1724] flex flex-col items-center justify-center bg-rose-50/20">
                  <span className="font-mono font-extrabold text-base text-[#6B1724]">
                    {formatSla(slaSeconds)}
                  </span>
                  <span className="text-[8px] text-stone-400 uppercase">remaining</span>
                </div>
              </div>
              <div className="text-xs bg-[#FAF5EE] p-3 rounded-xl border border-stone-200">
                <span className="text-stone-400 block text-[10px]">Allotted Authority Desk:</span>
                <p className="font-bold text-[#6B1724]">
                  {complaintData?.assignedDesignation || 'Initial Redressal Desk'}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  Escalates automatically if unaddressed
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row: Redressal Progression & Escalation History */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Redressal Status Progression */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
              <h3 className="font-bold text-stone-800 text-xs uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-2.5">
                Redressal Hierarchy Progression
              </h3>
              <div className="relative pl-5 space-y-5 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 text-xs">
                <div className="relative">
                  <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <p className="font-bold text-stone-800">Level 1: Field Redressal Desk</p>
                  <p className="text-[10px] text-stone-400 font-mono">
                    Initial intake by lowest rank authority (48 hours allotted).
                  </p>
                </div>
                <div className="relative">
                  <span
                    className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${
                      escalationLevel >= 2 ? 'bg-amber-500 text-white' : 'bg-stone-300'
                    }`}
                  >
                    {escalationLevel >= 2 && <i className="fa-solid fa-arrow-up"></i>}
                  </span>
                  <p className="font-bold text-stone-800">Level 2: Senior Department Officer</p>
                  <p className="text-[10px] text-stone-400 font-mono">
                    Automatic hierarchical escalation upon SLA expiry.
                  </p>
                </div>
                <div className="relative">
                  <span
                    className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${
                      escalationLevel >= 3 ? 'bg-purple-500 text-white' : 'bg-stone-300'
                    }`}
                  >
                    {escalationLevel >= 3 && <i className="fa-solid fa-arrow-up"></i>}
                  </span>
                  <p className="font-bold text-stone-800">Level 3: Executive Head / Dean</p>
                  <p className="text-[10px] text-stone-400 font-mono">
                    Departmental executive intervention.
                  </p>
                </div>
                <div className="relative">
                  <span
                    className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${
                      complaintData?.escalationStatus === 'admin_attention'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-stone-300'
                    }`}
                  >
                    {complaintData?.escalationStatus === 'admin_attention' && (
                      <i className="fa-solid fa-exclamation"></i>
                    )}
                  </span>
                  <p className="font-bold text-stone-800">Level 4: Ombudsman / Admin Attention</p>
                  <p className="text-[10px] text-stone-400 font-mono">
                    Flagged for institutional executive intervention if unaddressed.
                  </p>
                </div>
              </div>
            </div>

            {/* Escalation History & Audit Trail */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h3 className="font-bold text-stone-800 text-xs uppercase tracking-wider text-stone-400">
                  Escalation History Log
                </h3>
                <span className="text-[11px] font-mono text-stone-400">
                  {complaintData?.escalationHistory?.length || 0} Events
                </span>
              </div>

              {complaintData?.escalationHistory && complaintData.escalationHistory.length > 0 ? (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {complaintData.escalationHistory.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#FAF5EE] rounded-xl border border-stone-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#6B1724]">
                          Level {entry.previousLevel} → Level {entry.newLevel}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {formatDateTime(entry.escalatedAt)}
                        </span>
                      </div>
                      <p className="text-stone-700 text-[11px]">
                        <strong>From:</strong> {entry.previousAssignedDesignation || 'Initial Desk'}{' '}
                        → <strong>To:</strong> {entry.newAssignedDesignation || 'Next Level'}
                      </p>
                      <p className="text-[10px] text-stone-500 italic">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200 space-y-1">
                  <i className="fa-solid fa-clock-check text-2xl text-stone-300"></i>
                  <p className="font-semibold text-xs text-stone-600">Within Initial SLA Window</p>
                  <p className="text-[11px]">
                    This complaint is currently on Level 1. It will escalate automatically if not
                    resolved within the 48h deadline.
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500">Immutable Hash Chain:</span>
                <Link
                  to="/ledger"
                  className="text-[#6B1724] font-bold hover:underline flex items-center gap-1"
                >
                  <i className="fa-solid fa-fingerprint text-[10px]"></i> View Public Ledger
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PetitionDetails;
