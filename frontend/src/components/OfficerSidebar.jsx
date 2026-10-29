import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const LINKS = [
  { to: "/officerdash",           icon: "fa-gauge-high",   label: "Officer Console" },
  { to: "/officer/petitions",     icon: "fa-list-check",   label: "Assigned Petitions" },
  { to: "/officer/ledger",        icon: "fa-fingerprint",  label: "Audit Ledger" },
  { to: "/officer/analytics",     icon: "fa-chart-column", label: "Analytics & Trends" },
  { to: "/officer/notifications", icon: "fa-bell",         label: "Notifications" },
];

export default function OfficerSidebar({ name = "Authority Officer", designation = "Officer", initials = "AO", onLogout }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("nyaya_user_role") === "admin";

  const handleSwitchToStudent = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
      <div>
        <Link to="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
          <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
          <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "Cinzel, serif" }}>NyayaStack</span>
        </Link>

        <nav className="p-4 space-y-1 text-xs font-semibold">
          {LINKS.map((l) => {
            const active = pathname === l.to || (l.to !== "/officerdash" && pathname.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition ${
                  active ? "bg-[#6B1724] text-white shadow-sm" : "text-stone-600 hover:bg-stone-200/60"
                }`}
              >
                <i className={`fa-solid ${l.icon} w-4`}></i> {l.label}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <Link to="/admin/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-amber-900 bg-amber-100/60 hover:bg-amber-100 transition">
                <i className="fa-solid fa-shield-halved w-4 text-amber-700"></i> Admin Console
              </Link>
              <Link to="/admin/authority-requests" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-amber-900 bg-amber-100/60 hover:bg-amber-100 transition">
                <i className="fa-solid fa-user-check w-4 text-amber-700"></i> Authority Requests
              </Link>
            </>
          )}

          {/* Switch to Student View - Ab ye Login pe bhejega, direct dashboard nahi */}
          <button
            onClick={handleSwitchToStudent}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-emerald-900 bg-emerald-100/50 hover:bg-emerald-100 transition mt-4 border-t border-emerald-200/50"
          >
            <i className="fa-solid fa-user-graduate w-4 text-emerald-700"></i> Switch to Student View
          </button>
        </nav>
      </div>

      <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#6B1724] text-white flex items-center justify-center font-bold text-xs shadow-sm">{initials}</div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-stone-800 truncate">{name}</p>
            <p className="text-[10px] text-stone-500 font-mono truncate">{designation}</p>
          </div>
        </div>
        <button onClick={onLogout} title="Logout" className="text-stone-400 hover:text-[#6B1724] p-1.5 transition">
          <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
        </button>
      </div>
    </aside>
  );
}