import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import bg from "../assets/2ndbg.png";
import logo from "../assets/logo.png";

function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
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

    if (form.password.length < 6) {
      return setError("Password kam se kam 6 characters ka hona chahiye");
    }
    if (form.password !== form.confirmPassword) {
      return setError("Dono passwords match nahi kar rahe");
    }

    try {
      setLoading(true);
      const res = await fetch("http://localhost:3000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          rollNo: form.rollNo,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      navigate("/login");
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
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl border border-[#e6d9b5] shadow-xl p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src={logo} alt="NyayaStack" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold text-[#7a1620]">NyayaStack</span>
        </div>

        <h2 className="text-center text-2xl font-bold text-[#2b2118]">
          Create Account
        </h2>
        <p className="text-center text-sm text-gray-600 mb-6">
          Sign up to file and track your complaints
        </p>

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
            <label className={labelClass}>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Roll No.</label>
            <input
              type="text"
              name="rollNo"
              value={form.rollNo}
              onChange={handleChange}
              placeholder="Enter your roll number"
              className={inputClass}
              required
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
                placeholder="Create a password"
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
            <label className={labelClass}>Confirm Password</label>
            <input
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[#7a1620]">
            Login
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-gray-600">
          Are you an authority?{" "}
          <Link to="/authority/register" className="font-semibold text-[#7a1620]">
            Request authority access
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;

