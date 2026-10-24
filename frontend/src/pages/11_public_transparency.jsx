import React, { useState } from "react";
   import { Link } from "react-router-dom";

export default function PublicTransparency() {
  const [activeTab, setActiveTab] = useState("Overview");

  const tabs = ["Overview", "Category Trends", "Resolution Time", "SLA Compliance"];

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <a href="1_landing.html" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "Cinzel, serif" }}>NyayaStack</span>
          </a>
          <nav className="p-4 space-y-1 text-xs font-semibold">
            <a href="1_landing.html" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-house w-4"></i> Home</a>
            <a href="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-user-graduate w-4"></i> Student Login</a>
            <a href="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</a>
            <a href="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</a>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <a href="/officerdash" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-amber-900 bg-amber-100/50 hover:bg-amber-100 transition text-[11px]"><i className="fa-solid fa-user-shield w-4 text-amber-700"></i> Officer Console</a>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-stone-200/80 text-center text-xs text-stone-400 bg-[#F0E8DC]">Open Governance Portal</div>
      </aside>

      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-stone-800">Public Transparency Statistics</h1>
            <p className="text-xs text-stone-500">Live statistics and institutional redressal performance</p>
          </div>
          <span className="text-xs text-stone-600 bg-stone-100 px-3.5 py-1.5 rounded-full border border-stone-200 font-medium">Session 2026-27</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-6xl">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg transition ${activeTab === tab ? "bg-[#6B1724] text-white" : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Petitions Filed</p><h3 className="text-3xl font-extrabold text-[#6B1724] mt-1">248</h3><p className="text-xs text-stone-500 mt-0.5">Academic Session 2026</p></div>
              <div className="py-4 flex items-end justify-between gap-2 h-36 border-b border-stone-100">
                <div className="flex flex-col items-center flex-1 group cursor-pointer"><span className="text-[10px] font-bold text-blue-600">70</span><div className="w-full bg-blue-500 rounded-t h-20 group-hover:bg-blue-600 transition"></div><span className="text-[9px] text-stone-400 mt-1.5">Filed</span></div>
                <div className="flex flex-col items-center flex-1 group cursor-pointer"><span className="text-[10px] font-bold text-indigo-600">57</span><div className="w-full bg-indigo-500 rounded-t h-16 group-hover:bg-indigo-600 transition"></div><span className="text-[9px] text-stone-400 mt-1.5">Assigned</span></div>
                <div className="flex flex-col items-center flex-1 group cursor-pointer"><span className="text-[10px] font-bold text-amber-600">69</span><div className="w-full bg-amber-500 rounded-t h-20 group-hover:bg-amber-600 transition"></div><span className="text-[9px] text-stone-400 mt-1.5">In Review</span></div>
                <div className="flex flex-col items-center flex-1 group cursor-pointer"><span className="text-[10px] font-bold text-emerald-600">48</span><div className="w-full bg-emerald-500 rounded-t h-14 group-hover:bg-emerald-600 transition"></div><span className="text-[9px] text-stone-400 mt-1.5">Resolved</span></div>
                <div className="flex flex-col items-center flex-1 group cursor-pointer"><span className="text-[10px] font-bold text-rose-600">4</span><div className="w-full bg-rose-500 rounded-t h-3 group-hover:bg-rose-600 transition"></div><span className="text-[9px] text-stone-400 mt-1.5">Escalated</span></div>
              </div>
              <div className="text-xs text-stone-400 pt-2 text-center flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Synchronized in real-time</div>
            </div>

            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div><h4 className="font-bold text-sm text-stone-800">Category Distribution</h4><p className="text-[11px] text-stone-400">Breakdown of student petitions</p></div>
              <div className="py-3 flex items-center justify-center"><div className="w-28 h-28 rounded-full border-8 border-rose-100 border-t-[#6B1724] border-r-amber-500 border-b-blue-500 border-l-emerald-500 flex items-center justify-center font-bold text-xs text-[#6B1724]">Nyaya</div></div>
              <div className="space-y-1.5 text-xs"><div className="flex justify-between"><span>🔴 Hostel & Mess</span><span className="font-bold">28%</span></div><div className="flex justify-between"><span>🟡 Academics</span><span className="font-bold">20%</span></div><div className="flex justify-between"><span>🔵 Infrastructure</span><span className="font-bold">18%</span></div><div className="flex justify-between"><span>🟣 Harassment & Safety</span><span className="font-bold">6%</span></div><div className="flex justify-between"><span>⚪ Others</span><span className="font-bold">28%</span></div></div>
            </div>

            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
              <div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Resolution Time (Average)</p><h3 className="text-2xl font-extrabold text-stone-800 mt-1">2.4 days</h3><p className="text-[11px] text-emerald-600 font-semibold">Reduced by 45% with AI clustering</p></div>
              <div className="py-4"><div className="h-24 flex items-end justify-between gap-2 border-b border-stone-200 pb-1"><div className="w-full bg-rose-100 rounded-t h-[80%]"></div><div className="w-full bg-rose-100 rounded-t h-[65%]"></div><div className="w-full bg-rose-100 rounded-t h-[52%]"></div><div className="w-full bg-[#6B1724] rounded-t h-[38%]"></div></div><div className="flex justify-between text-[9px] text-stone-400 mt-1.5 font-mono"><span>Wk 1</span><span>Wk 2</span><span>Wk 3</span><span>Current</span></div></div>
              <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl text-center font-semibold border border-emerald-100">SLA Compliance: 94% on-time resolution</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}