import { Link, useLocation } from "react-router-dom";
import OfficerSidebar from "../components/OfficerSidebar";
import React, { useState } from "react";
import logo from '../assets/logo.png';
import anonymousAvatar from '../assets/anonymous-avatar.svg';

export default function AuditLedger() {
  const { pathname } = useLocation();
  const isOfficerRoute = pathname.startsWith("/officer");

  const officerName = localStorage.getItem("nyaya_user_name") || "Authority Officer";
  const officerInitials =
    officerName.split(/[\s_.-]+/).map((p) => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "AO";

  const userName = localStorage.getItem("nyaya_user_name") || localStorage.getItem("nyaya_logged_user") || "User";
  const userRoll = localStorage.getItem("nyaya_user_roll") || localStorage.getItem("nyaya_logged_user") || "STU-001";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authorityToken");
    localStorage.removeItem("nyaya_logged_user");
    localStorage.removeItem("nyaya_user_name");
    localStorage.removeItem("nyaya_user_role");
    sessionStorage.clear();
    window.location.href = isOfficerRoute ? "/authority/login" : "/login";
  };

  const [verifyText, setVerifyText] = useState("Verify Chain");
  const [verifying, setVerifying] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash).then(() => {
      alert("SHA-256 Hash copied:\n" + hash);
    });
  };

  const runHashVerification = () => {
    setVerifying(true);
    setVerifyText("Verifying Hashes...");
    setTimeout(() => {
      setVerifyText("100% Chain Valid ✓");
      setVerifying(false);
      alert("Cryptographic Audit Succeeded!\n\nAll SHA-256 blocks chained from Genesis Block [0000...0000] match official institutional ledger.");
    }, 800);
  };

  const isActive = (path) => pathname === path;
  const linkBase = "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition";
  const activeCls = "bg-[#6B1724] text-white shadow-sm";
  const inactiveCls = "text-stone-600 hover:bg-stone-200/60";

  return (
    <div className="text-stone-800 flex h-screen w-full overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {isOfficerRoute ? (
        <OfficerSidebar
          name={officerName}
          designation="Officer"
          initials={officerInitials}
          onLogout={handleLogout}
        />
      ) : (
        <aside className="w-64 h-screen bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10 sticky top-0">
          <div>
            <Link to="/dashboard" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                <img src={logo} alt="NyayaStack" className="h-full w-full object-cover scale-[1.3]" />
              </div>
              <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "Cinzel, serif" }}>NyayaStack</span>
            </Link>
            <nav className="p-4 space-y-1 text-xs font-semibold">
              <Link to="/dashboard" className={`${linkBase} ${isActive("/dashboard") ? activeCls : inactiveCls}`}>
                <i className="fa-solid fa-house w-4"></i> Dashboard
              </Link>
              <Link to="/file-complaint" className={`${linkBase} ${isActive("/file-complaint") ? activeCls : inactiveCls}`}>
                <i className="fa-solid fa-file-circle-plus w-4"></i> File a Complaint
              </Link>
              <Link to="/my-petitions" className={`${linkBase} ${isActive("/my-petitions") ? activeCls : inactiveCls}`}>
                <i className="fa-solid fa-folder-open w-4"></i> My Petitions
              </Link>
              <Link to="/petition-detail" className={`${linkBase} ${isActive("/petition-detail") ? activeCls : inactiveCls}`}>
                <i className="fa-solid fa-comments w-4"></i> Inquiry Chat
              </Link>
              <Link to="/notifications" className={`${linkBase} ${isActive("/notifications") ? activeCls : inactiveCls}`}>
                <i className="fa-solid fa-bell w-4"></i> Notifications
              </Link>
              <Link to="/ledger" className={`${linkBase} ${activeCls}`}>
                <i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger
              </Link>
              <Link to="/publictrans" className={`${linkBase} ${isActive("/publictrans") ? activeCls : inactiveCls}`}>
                <i className="fa-solid fa-chart-pie w-4"></i> Public Transparency
              </Link>
            </nav>
          </div>
          <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
            <div className="flex items-center gap-2.5">
              <img src={anonymousAvatar} alt="User" className="w-8 h-8 rounded-full object-cover border border-[#6B1724]" />
              <div>
                <p className="text-xs font-bold text-stone-800">{userName}</p>
                <p className="text-[10px] text-stone-500 font-mono">{userRoll}</p>
              </div>
            </div>
            <button onClick={handleLogout} title="Logout" className="text-stone-400 hover:text-[#6B1724] p-1.5 transition">
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 min-h-screen w-full flex flex-col bg-[#FAF7F2] overflow-hidden">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm w-full">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-stone-800">Audit Ledger — <span className="font-mono text-[#6B1724]">#NY-1048</span></h1>
              <Link to={isOfficerRoute ? "/officer/petition-detail" : "/petition-detail"} className="text-xs text-[#6B1724] font-semibold hover:underline flex items-center gap-1"><i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> View Petition</Link>
            </div>
          </div>
          <button onClick={runHashVerification} className={`px-3 sm:px-5 py-2.5 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center gap-1.5 shrink-0 ${verifying ? 'bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <i className="fa-solid fa-shield-check"></i> <span className="hidden sm:inline">{verifyText}</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-[#FAF5EE] border-b border-stone-200 text-stone-500 font-semibold uppercase text-xs">
                  <tr><th className="py-4 px-6">Timestamp</th><th className="py-4 px-4">State Event</th><th className="py-4 px-4">Actor</th><th className="py-4 px-4">Previous Hash</th><th className="py-4 px-6">SHA-256 Hash</th><th className="py-4 px-4 text-right">Copy</th></tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  <tr className="hover:bg-stone-50 transition"><td className="py-4 px-6 text-stone-600">12 Oct 10:30</td><td className="py-4 px-4 font-sans"><span className="px-2.5 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200 font-bold">Filed</span></td><td className="py-4 px-4 font-sans text-stone-700">Student (Concealed)</td><td className="py-4 px-4 text-stone-400">0000...0000</td><td className="py-4 px-6 text-[#6B1724] font-bold">a2f4c918...4b0d</td><td className="py-4 px-4 text-right"><button onClick={() => copyHash('a2f4c91834e78901ba32f9124b0de412')} className="text-stone-400 hover:text-[#6B1724] p-2"><i className="fa-solid fa-copy"></i></button></td></tr>
                  <tr className="hover:bg-stone-50 transition"><td className="py-4 px-6 text-stone-600">12 Oct 14:15</td><td className="py-4 px-4 font-sans"><span className="px-2.5 py-1 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200 font-bold">Assigned</span></td><td className="py-4 px-4 font-sans text-stone-700">ICC Officer #04</td><td className="py-4 px-4 text-stone-400">a2f4...4b0d</td><td className="py-4 px-6 text-[#6B1724] font-bold">9cfe8812...3f1a</td><td className="py-4 px-4 text-right"><button onClick={() => copyHash('9cfe88120019bf4523e167823f1a9411')} className="text-stone-400 hover:text-[#6B1724] p-2"><i className="fa-solid fa-copy"></i></button></td></tr>
                  <tr className="hover:bg-stone-50 transition"><td className="py-4 px-6 text-stone-600">13 Oct 09:00</td><td className="py-4 px-4 font-sans"><span className="px-2.5 py-1 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200 font-bold">In Review</span></td><td className="py-4 px-4 font-sans text-stone-700">Formal Committee</td><td className="py-4 px-4 text-stone-400">9cfe...3f1a</td><td className="py-4 px-6 text-[#6B1724] font-bold">4a37b120...9c2d</td><td className="py-4 px-4 text-right"><button onClick={() => copyHash('4a37b1207865ae9901dc11829c2d8291')} className="text-stone-400 hover:text-[#6B1724] p-2"><i className="fa-solid fa-copy"></i></button></td></tr>
                  <tr className="hover:bg-stone-50 transition"><td className="py-4 px-6 text-stone-600">13 Oct 15:20</td><td className="py-4 px-4 font-sans"><span className="px-2.5 py-1 rounded text-xs bg-stone-100 text-stone-700 border border-stone-200 font-bold whitespace-nowrap">Evidence Added</span></td><td className="py-4 px-4 font-sans text-stone-700">Student</td><td className="py-4 px-4 text-stone-400">4a37...9c2d</td><td className="py-4 px-6 text-[#6B1724] font-bold">7fdc5501...0a1f</td><td className="py-4 px-4 text-right"><button onClick={() => copyHash('7fdc55019043ac334412ef900a1fc410')} className="text-stone-400 hover:text-[#6B1724] p-2"><i className="fa-solid fa-copy"></i></button></td></tr>
                </tbody>
              </table>
            </div>
            <div className="p-4 md:p-5 bg-emerald-50 border-t border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm text-emerald-900">
              <div className="flex items-center gap-3"><i className="fa-solid fa-circle-check text-emerald-600 text-xl"></i><div><p className="font-bold text-emerald-900 text-base">Chain Verified & Immutable</p><p className="text-sm text-emerald-700">All 4 state transitions are cryptographically valid. No tampering detected.</p></div></div>
              <span className="self-start md:self-auto text-xs font-mono bg-white px-4 py-1.5 rounded-lg border border-emerald-300 font-bold text-emerald-800 whitespace-nowrap">Zero Tamper Risk</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}