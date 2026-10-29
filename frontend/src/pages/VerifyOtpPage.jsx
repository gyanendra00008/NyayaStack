import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import bg from "../assets/2ndbg.png";
import logo from "../assets/logo.png";

const API = "http://localhost:5000/api/auth";

function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // TEMPORARY: design dekhne ke liye comment kiya hai.
  // Dekhne ke baad wapas uncomment kar dena.
  // useEffect(() => {
  //   if (!email) navigate("/register", { replace: true });
  // }, [email, navigate]);

  // Resend ka countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!/^\d{6}$/.test(otp)) {
      return setError("OTP 6 digit ka hona chahiye");
    }

    try {
      setLoading(true);
      const res = await fetch(`${API}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");

      // Verify ke baad backend token deta hai
      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "role",
        data.user.role === "officer" ? "authority" : "citizen"
      );
      navigate(data.user.role === "officer" ? "/officerdash" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    try {
      const res = await fetch(`${API}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not resend OTP");
      setInfo("Naya OTP bhej diya gaya hai");
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-center"
      style={{ backgroundImage: `url(${bg})` }}
    >
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl border border-[#e6d9b5] shadow-xl p-5 sm:p-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src={logo} alt="NyayaStack" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold text-[#7a1620]">NyayaStack</span>
        </div>

        <h2 className="text-center text-2xl font-bold text-[#2b2118]">
          Verify Email
        </h2>
        <p className="text-center text-sm text-gray-600 mb-6 break-words">
          6 digit OTP <span className="font-semibold">{email}</span> pe bheja gaya hai
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#2b2118] mb-1">
              Enter OTP
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="______"
              className="w-full px-4 py-3 rounded-lg border border-[#e6d9b5] bg-white text-center text-xl sm:text-2xl tracking-[0.3em] sm:tracking-[0.5em] outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#7a1620] text-white font-semibold hover:bg-[#5e1019] transition disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          OTP nahi mila?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="font-semibold text-[#7a1620] disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </p>

        <p className="mt-3 text-center text-sm text-gray-600">
          <Link to="/login" className="font-semibold text-[#7a1620]">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyOtpPage;