import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import bg from '../assets/2ndbg.png'
import logo from '../assets/logo.png'

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()

    // TODO: backend ready hone par yahan fetch() se real login lagana
    // Abhi dummy login: role save karke dashboard bhej rahe hain
    const storage = remember ? localStorage : sessionStorage
    storage.setItem('role', 'citizen')
    navigate('/dashboard')
  }

  const handleInstituteLogin = () => {
    console.log('Institute login clicked')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-no-repeat bg-[#f6efe6] bg-[position:center_top]"
      style={{ backgroundImage: `url(${bg})` }}
    >
      {/* Card */}
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl shadow-xl border border-[#e6d7b8] p-5 sm:p-8">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
            <img
              src={logo}
              alt="NyayaStack"
              className="h-full w-full object-cover scale-[1.3]"
            />
          </div>
          <span className="text-2xl font-bold text-[#7a1620] font-serif">NyayaStack</span>
        </div>

        <h1 className="mt-5 text-center text-2xl font-bold font-serif text-[#3b2a20]">
          Welcome Back
        </h1>
        <p className="text-center text-sm text-[#3b2a20]/70">Login to your account</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Email / Roll No */}
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-[#3b2a20] mb-1">
              Email / Roll No.
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="Enter email or roll number"
              className="w-full px-4 py-2.5 rounded-lg bg-white text-[#3b2a20] border border-[#e6d7b8] placeholder:text-[#3b2a20]/40 focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#3b2a20] mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                className="w-full px-4 py-2.5 pr-11 rounded-lg bg-white text-[#3b2a20] border border-[#e6d7b8] placeholder:text-[#3b2a20]/40 focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 px-3 text-[#3b2a20]/60 hover:text-[#7a1620]"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 text-[#3b2a20] cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 accent-[#7a1620]"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-[#7a1620] font-medium hover:underline">
              Forgot Password?
            </Link>
          </div>

          {/* Login button */}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold transition"
          >
            Login
          </button>

          {/* OR divider */}
          <div className="flex items-center gap-3 text-xs text-[#3b2a20]/60">
            <span className="flex-1 h-px bg-[#e6d7b8]" />
            OR
            <span className="flex-1 h-px bg-[#e6d7b8]" />
          </div>

          {/* Institute login */}
          <button
            type="button"
            onClick={handleInstituteLogin}
            className="w-full py-2.5 rounded-lg border border-[#7a1620] bg-white/70 text-[#7a1620] font-medium hover:bg-white transition flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" />
            </svg>
            Continue with Institute Login
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#3b2a20]/80">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-[#7a1620] font-semibold hover:underline">
            Sign Up
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-[#3b2a20]/80">
          Are you an authority?{' '}
          <Link to="/authority-login" className="text-[#7a1620] font-semibold hover:underline">
            Authority Login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login