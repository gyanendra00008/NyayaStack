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

function AuthorityLogin() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      setLoading(true)
      const res = await fetch('http://localhost:3000/auth/authority/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')

      // Token + role store karo (backend se { token } aata hai maan ke chal rahe hain)
      const storage = remember ? localStorage : sessionStorage
      storage.setItem('authorityToken', data.token)
      storage.setItem('role', 'authority')

      navigate('/officerdash')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-no-repeat bg-[#f6efe6] bg-[position:center_top]"
      style={{ backgroundImage: `url(${bg})` }}
    >
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl shadow-xl border border-[#e6d7b8] p-5 sm:p-8">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
            <img src={logo} alt="NyayaStack" className="h-full w-full object-cover scale-[1.3]" />
          </div>
          <span className="text-2xl font-bold text-[#7a1620] font-serif">NyayaStack</span>
        </div>

        {/* Authority badge */}
        <div className="mt-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7a1620]/30 bg-[#7a1620]/5 px-3 py-1 text-xs font-semibold text-[#7a1620]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6l-8-3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
            </svg>
            Authority Portal
          </span>
        </div>

        <h1 className="mt-4 text-center text-2xl font-bold font-serif text-[#3b2a20]">
          Authority Login
        </h1>
        <p className="text-center text-sm text-[#3b2a20]/70">
          Sign in to review and resolve complaints
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Official email / Employee ID */}
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-[#3b2a20] mb-1">
              Official Email / Employee ID
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="Enter official email or employee ID"
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold transition disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Login as Authority'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#3b2a20]/80">
          New authority?{' '}
          <Link to="/authority-register" className="text-[#7a1620] font-semibold hover:underline">
            Request access
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-[#3b2a20]/80">
          Are you a student?{' '}
          <Link to="/login" className="text-[#7a1620] font-semibold hover:underline">
            Student login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default AuthorityLogin