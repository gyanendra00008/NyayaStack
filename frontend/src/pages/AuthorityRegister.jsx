import { useState } from "react";
import { Link } from "react-router-dom";
import bg from "../assets/2ndbg.png";
import logo from "../assets/logo.png";

const DEPARTMENTS = [
  "Academic Affairs",
  "Hostel & Mess",
  "Examination Cell",
  "Anti-Ragging Committee",
  "Internal Complaints Committee",
  "Library",
  "IT & Infrastructure",
  "Administration",
];

const DESIGNATIONS = [
  "Warden",
  "Faculty Coordinator",
  "Head of Department",
  "Registrar",
  "Dean",
  "Committee Member",
  "Administrative Officer",
];

function AuthorityRegister() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    employeeId: "",
    department: "",
    designation: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      return setError("Password kam se kam 8 characters ka hona chahiye");
    }
    if (form.password !== form.confirmPassword) {
      return setError("Dono passwords match nahi kar rahe");
    }

    try {
      setLoading(true);
      const res = await fetch("http://localhost:3000/auth/authority/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          employeeId: form.employeeId,
          department: form.department,
          designation: form.designation,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src={logo} alt="NyayaStack" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold text-[#7a1620]">NyayaStack</span>
        </div>

        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7a1620]/30 bg-[#7a1620]/5 px-3 py-1 text-xs font-semibold text-[#7a1620]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6l-8-3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
            </svg>
            Authority Portal
          </span>
        </div>

        {submitted ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#2b2118]">Request submitted</h2>
            <p className="mt-2 text-sm text-gray-600">
              Aapka account admin verify karega. Approval milne ke baad aap login kar sakte hain.
            </p>
            <Link
              to="/authority-login"
              className="mt-6 inline-block w-full py-2.5 rounded-lg bg-[#7a1620] text-white font-semibold hover:bg-[#5e1019] transition"
            >
              Go to Authority Login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-center text-2xl font-bold text-[#2b2118]">
              Request Authority Access
            </h2>
            <p className="text-center text-sm text-gray-600 mb-6">
              Accounts are verified by the admin before activation
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className={labelClass}>Full Name</label>
                <input
                  id="name"
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
                <label htmlFor="email" className={labelClass}>Official Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@institute.edu"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="employeeId" className={labelClass}>Employee ID</label>
                <input
                  id="employeeId"
                  type="text"
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  placeholder="Enter your employee ID"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="department" className={labelClass}>Department</label>
                <select
                  id="department"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="designation" className={labelClass}>Designation</label>
                <select
                  id="designation"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>Select designation</option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a password (min 8 characters)"
                    className={inputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#7a1620]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={inputClass}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-[#7a1620] text-white font-semibold hover:bg-[#5e1019] transition disabled:opacity-60"
              >
                {loading ? "Submitting request..." : "Request Access"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an authority account?{" "}
              <Link to="/authority-login" className="font-semibold text-[#7a1620]">
                Login
              </Link>
            </p>
            <p className="mt-3 text-center text-sm text-gray-600">
              Are you a student?{" "}
              <Link to="/register" className="font-semibold text-[#7a1620]">
                Student sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthorityRegister;