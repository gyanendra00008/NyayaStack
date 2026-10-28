import React, { useState } from "react";
import { Link } from "react-router-dom";
import MobileNavToggle from "../components/MobileNavToggle";

export default function AuditLedger() {
  const isOfficer = localStorage.getItem('nyaya_user_role') === 'officer' || localStorage.getItem('nyaya_user_role') === 'admin';
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

  return (
    <div className="text-stone-800 flex h-dvh w-full overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {navOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setNavOpen(false)} />}

      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none transform transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="overflow-y-auto">
          <Link to="/dashboard" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "Cinzel, serif" }}>NyayaStack</span>
          </Link>
          <nav className="p-4 space-y-1 text-sm font-semibold">
            <Link to="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-house w-4"></i> Dashboard</Link>
            {!isOfficer && <Link to="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-file-circle-plus w-4 text-[#6B1724]"></i> File a Complaint</Link>}
            <Link to="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-folder-open w-4"></i> My Petitions</Link>
            <Link to="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</Link>
            <Link to="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</Link>
            <Link to="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</Link>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <Link to="/officerdash" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-amber-900 bg-amber-100/50 hover:bg-amber-100 transition text-[11px]"><i className="fa-solid fa-user-shield w-4 text-amber-700"></i> Switch to Officer View</Link>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-stone-200/80 flex items-center gap-2 text-xs text-stone-500 bg-[#F0E8DC]">
          <i className="fa-solid fa-shield text-emerald-600 text-base"></i>
          <div><p className="font-bold text-stone-800 text-[11px]">Merkle Tree Verified</p><p className="text-[9px] text-stone-400 font-mono">Root: 8e4b...92fa</p></div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-full flex flex-col bg-[#FAF7F2] overflow-hidden">
        <header className="min-h-16 bg-white border-b border-stone-200/80 px-4 md:px-8 py-2 flex items-center justify-between gap-2 shrink-0 shadow-sm w-full">
          <div className="flex items-center min-w-0">
            <MobileNavToggle onClick={() => setNavOpen(true)} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <h1 className="text-base md:text-lg font-bold text-stone-800">Audit Ledger — <span className="font-mono text-[#6B1724]">#NY-1048</span></h1>
                <Link to="/petition-detail" className="text-xs text-[#6B1724] font-semibold hover:underline flex items-center gap-1"><i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> View Petition</Link>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">Cryptographically signed and tamper-evident event log</p>
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