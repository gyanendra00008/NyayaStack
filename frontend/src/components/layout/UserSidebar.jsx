import { Link, useLocation } from "react-router-dom";
import OfficerSidebar from "../components/OfficerSidebar";
import UserSidebar from "../components/UserSidebar";
import React, { useState } from "react";

export default function AuditLedger() {
  const { pathname } = useLocation();
  const isOfficerRoute = pathname.startsWith("/officer");

  const officerName = localStorage.getItem("nyaya_user_name") || "Authority Officer";
  const userName = localStorage.getItem("nyaya_user_name") || "User";
  
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = isOfficerRoute ? "/authority/login" : "/login";
  };

  const [verifyText, setVerifyText] = useState("Verify Chain");
  // ... baki ka tumhara table wala code same rakhna ...

  return (
    <div className="flex h-screen w-full bg-[#FAF7F2]">
      {isOfficerRoute ? (
        <OfficerSidebar name={officerName} initials="AO" onLogout={handleLogout} />
      ) : (
        <UserSidebar name={userName} initials="U" onLogout={handleLogout} />
      )}
      {/* Tumhara main table wala code yaha se */}
      <main className="flex-1 overflow-y-auto p-8">
         {/* ... table ... */}
      </main>
    </div>
  )
}