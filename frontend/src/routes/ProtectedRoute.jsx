import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ role, children }) {
  const userRole = localStorage.getItem("role") || sessionStorage.getItem("role");

  if (!userRole) {
    return <Navigate to={role === "authority" ? "/authority-login" : "/login"} replace />;
  }
  if (userRole !== role) {
    return <Navigate to={userRole === "authority" ? "/officerdash" : "/dashboard"} replace />;
  }
  return children;
}