import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import { authApi } from "../services/api";
import bg from "../assets/2ndbg.png";
import logo from "../assets/logo.png";

function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration step: 1 = Enter details, 2 = Verify OTP
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");

  const [form, setForm] = useState({
    username: "",
    name: "",
    email: "",
    rollNo: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Generate sanitized username if not explicitly set
    const candidateUsername = (form.username || form.name || form.email.split("@")[0])
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "_")
      .slice(0, 30);

    const safeUsername = candidateUsername.length >= 3 ? candidateUsername : `${candidateUsername}123`.slice(0, 30);

    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters long.");
    }
    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match.");
    }

    try {
      setLoading(true);
      const res = await authApi.register({
        username: safeUsername,
        fullName: form.name.trim(),
        rollNo: form.rollNo.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (form.rollNo) {
        localStorage.setItem("nyaya_user_roll", form.rollNo);
      }
      localStorage.setItem("nyaya_user_name", form.name || safeUsername);

      // Transition to OTP verification step
      setStep(2);
      setOtpMessage(
        res.data?.message || "Verification code dispatched to your email. Please check your inbox."
      );
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Registration failed. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);

    try {
      const res = await authApi.verifyOtp({
        email: form.email.trim().toLowerCase(),
        otp: otp.trim(),
      });

      const { token, user } = res.data;
      if (token) {
        localStorage.setItem("token", token);
      }
      if (user?.username) {
        localStorage.setItem("nyaya_logged_user", user.username);
        localStorage.setItem("nyaya_user_name", user.username);
      }

      dispatch(setCredentials({ user, token }));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Invalid or expired OTP code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setOtpMessage("");
    try {
      await authApi.resendOtp({ email: form.email.trim().toLowerCase() });
      setOtpMessage("A new verification code has been dispatched to your email.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to resend verification OTP.");
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-[#e6d9b5] bg-white text-sm outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]";
  const labelClass = "block text-sm font-semibold text-[#2b2118] mb-1";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-center"
      style={{ backgroundImage: `url(${bg})` }}
    >
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl border border-[#e6d9b5] shadow-xl p-5 sm:p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src={logo} alt="NyayaStack" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold text-[#7a1620]">NyayaStack</span>
        </div>

        {step === 1 ? (
          <>
            <h2 className="text-center text-2xl font-bold text-[#2b2118]">
              Create Account
            </h2>
            <p className="text-center text-sm text-gray-600 mb-6">
              Sign up to file and track your petitions
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Username</label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="e.g. rahul_sharma"
                  className={inputClass}
                />
                <p className="text-[10px] text-stone-500 mt-0.5">3-30 letters, numbers, dot, or underscore</p>
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Roll / ID Number (Optional)</label>
                <input
                  type="text"
                  name="rollNo"
                  value={form.rollNo}
                  onChange={handleChange}
                  placeholder="e.g. 22BCS045"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="At least 8 characters"
                    className={`${inputClass} pr-12`}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-xs text-gray-500 hover:text-[#7a1620]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#7a1620] text-white rounded-lg font-semibold hover:bg-[#5e1018] transition text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? "Registering..." : "Create Account"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-[#7a1620] font-semibold hover:underline">
                Log In
              </Link>
            </p>
          </>
        ) : (
          /* Step 2: OTP Email Verification */
          <div>
            <h2 className="text-center text-2xl font-bold text-[#2b2118]">
              Verify Email Address
            </h2>
            <p className="text-center text-sm text-gray-600 mt-1">
              Enter the 6-digit verification code dispatched to:
            </p>
            <p className="text-center text-sm font-semibold font-mono text-[#7a1620] mb-4">
              {form.email}
            </p>

            {otpMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
                {otpMessage}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl py-3 rounded-lg border border-[#e6d9b5] bg-white focus:outline-none focus:border-[#7a1620]"
                />
              </div>

              <button
                type="submit"
                disabled={otpLoading || otp.length !== 6}
                className="w-full py-3 bg-[#7a1620] text-white rounded-lg font-semibold hover:bg-[#5e1018] transition text-sm disabled:opacity-60"
              >
                {otpLoading ? "Verifying..." : "Verify & Activate Account"}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-[#7a1620] font-semibold hover:underline"
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-stone-500 hover:underline"
                >
                  Edit Registration Info
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Register;
