import React from "react";
   import { Link } from "react-router-dom";

export default function OfficerDashboard() {
  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* SIDEBAR */}
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <a href="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "Cinzel, serif" }}>NyayaStack</span>
          </a>
          <nav className="p-4 space-y-1 text-xs font-semibold">
            <a href="/officerdash" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm">
              <i className="fa-solid fa-gauge-high w-4"></i> Officer Console
            </a>
            <a href="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-list-check w-4"></i> Assigned Petitions
            </a>
            <a href="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-fingerprint w-4 text-[#6B1724]"></i> Audit Ledger
            </a>
            <a href="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-chart-column w-4"></i> Analytics & Trends
            </a>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <a href="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-emerald-900 bg-emerald-100/50 hover:bg-emerald-100 transition text-[11px]">
                <i className="fa-solid fa-user-graduate w-4 text-emerald-700"></i> Switch to Student View
              </a>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-white flex items-center justify-center font-bold text-xs shadow-sm">RV</div>
            <div>
              <p className="text-xs font-bold text-stone-800">Dr. Rajesh Varma</p>
              <p className="text-[10px] text-stone-500 font-mono">Grievance Officer</p>
            </div>
          </div>
          <a href="/login" title="Logout" className="text-stone-400 hover:text-[#6B1724] p-1.5 transition">
            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
          </a>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-stone-800">Officer Redressal Console</h1>
            <p className="text-xs text-stone-500">Real-Time Grievance Workqueue with AI Semantic Clustering</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> SLA Active Oversight
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div><p className="text-[10px] font-bold text-stone-400 uppercase">Assigned to Me</p><h3 className="text-2xl font-extrabold mt-1">18</h3><p className="text-[10px] text-stone-400 mt-1">Across 8 categories</p></div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center text-xl"><i className="fa-solid fa-inbox"></i></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div><p className="text-[10px] font-bold text-stone-400 uppercase">Pending SLA</p><h3 className="text-2xl font-extrabold text-amber-600 mt-1">5</h3><p className="text-[10px] text-rose-500 font-semibold mt-1">1 Near Breach (&lt;2h)</p></div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl"><i className="fa-solid fa-clock"></i></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div><p className="text-[10px] font-bold text-stone-400 uppercase">Resolved (This Month)</p><h3 className="text-2xl font-extrabold text-emerald-600 mt-1">42</h3><p className="text-[10px] text-emerald-600 font-semibold mt-1">94% within SLA</p></div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl"><i className="fa-solid fa-circle-check"></i></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
              <div><p className="text-[10px] font-bold text-stone-400 uppercase">Escalated</p><h3 className="text-2xl font-extrabold text-rose-600 mt-1">3</h3><p className="text-[10px] text-stone-400 mt-1">Ombudsman Desk</p></div>
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center text-xl"><i className="fa-solid fa-triangle-exclamation"></i></div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-rose-50/70 to-amber-50/70 p-6 rounded-2xl border border-[#6B1724]/20 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm"><i className="fa-solid fa-network-wired"></i></div>
                <div><h3 className="font-bold text-sm text-[#6B1724]">AI Semantic Problem Clusters</h3><p className="text-xs text-stone-600">Grouped by issue similarity</p></div>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#6B1724] text-white">3 Active Clusters</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-5 rounded-xl border shadow-sm space-y-2.5">
                <div className="flex justify-between"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">Hostel & Mess</span><span className="font-bold text-rose-600">14 Complaints</span></div>
                <h4 className="font-bold text-sm">Block B Water Supply Disruption</h4>
                <p className="text-stone-500">Low water pressure and broken pipes reported across 2nd & 3rd floors.</p>
                <div className="pt-2.5 flex justify-between border-t"><span className="text-[10px] text-stone-400">Similarity: 96%</span>
                <button onClick={() => alert('14 complaints grouped into Single Master Resolution Ticket.')} className="px-3 py-1 bg-[#6B1724] text-white rounded-lg">Bulk Action</button></div>
              </div>
              <div className="bg-white p-5 rounded-xl border shadow-sm space-y-2.5">
                <div className="flex justify-between"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">Harassment & Safety</span><span className="font-bold text-rose-600">8 Complaints</span></div>
                <h4 className="font-bold text-sm">Gate No. 2 Evening Intimidation</h4>
                <p className="text-stone-500">Repeated evening verbal harassment near campus perimeter.</p>
                <div className="pt-2.5 flex justify-between border-t"><span className="text-[10px] text-stone-400">Similarity: 92%</span>
                <button onClick={() => alert('Campus Security CCTV review requisitioned for Gate No. 2.')} className="px-3 py-1 bg-[#6B1724] text-white rounded-lg">Bulk Action</button></div>
              </div>
              <div className="bg-white p-5 rounded-xl border shadow-sm space-y-2.5">
                <div className="flex justify-between"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">Academics</span><span className="font-bold text-rose-600">11 Complaints</span></div>
                <h4 className="font-bold text-sm">Mid-Term Grading Re-Evaluation</h4>
                <p className="text-stone-500">Discrepancy in CS-301 Algorithm marking scheme reported.</p>
                <div className="pt-2.5 flex justify-between border-t"><span className="text-[10px] text-stone-400">Similarity: 88%</span>
                <button onClick={() => alert('Forwarded to Dean of Academic Affairs.')} className="px-3 py-1 bg-[#6B1724] text-white rounded-lg">Bulk Action</button></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold">My Assigned Petitions</h2><a href="/my-petitions" className="text-xs text-[#6B1724] font-semibold">View All →</a></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b text-stone-400 uppercase text-[10px]"><th className="py-2.5 px-3">Petition ID</th><th className="py-2.5 px-3">Category</th><th className="py-2.5 px-3">Priority</th><th className="py-2.5 px-3">Filed On</th><th className="py-2.5 px-3">SLA Deadline</th><th className="py-2.5 px-3 text-right">Action</th></tr></thead>
                <tbody className="divide-y font-medium">
                  <tr className="hover:bg-stone-50"><td className="py-3.5 px-3 font-mono font-bold text-[#6B1724]">#NY-1048</td><td className="py-3.5 px-3">Harassment & Safety</td><td className="py-3.5 px-3"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">High</span></td><td className="py-3.5 px-3 text-stone-500">12 Oct 10:30</td><td className="py-3.5 px-3 text-rose-600 font-bold">01h 24m remaining</td><td className="py-3.5 px-3 text-right"><a href="/petition-detail" className="px-3 py-1 bg-[#6B1724] text-white rounded-lg">Open Docket</a></td></tr>
                  <tr className="hover:bg-stone-50"><td className="py-3.5 px-3 font-mono font-bold text-[#6B1724]">#NY-1050</td><td className="py-3.5 px-3">Infrastructure</td><td className="py-3.5 px-3"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">High</span></td><td className="py-3.5 px-3 text-stone-500">12 Oct 14:00</td><td className="py-3.5 px-3">02h 10m</td><td className="py-3.5 px-3 text-right"><a href="/petition-detail" className="px-3 py-1 bg-stone-100 rounded-lg">Open Docket</a></td></tr>
                  <tr className="hover:bg-stone-50"><td className="py-3.5 px-3 font-mono font-bold text-[#6B1724]">#NY-1049</td><td className="py-3.5 px-3">Hostel & Mess</td><td className="py-3.5 px-3"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">Medium</span></td><td className="py-3.5 px-3 text-stone-500">11 Oct 16:45</td><td className="py-3.5 px-3">05h 20m</td><td className="py-3.5 px-3 text-right"><a href="/petition-detail" className="px-3 py-1 bg-stone-100 rounded-lg">Open Docket</a></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}