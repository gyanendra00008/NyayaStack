import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/slices/authSlice'
import { authApi } from '../services/api'
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

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState(
    location.state?.roleMismatch
      ? 'Institutional Administrator credentials are required to access this portal.'
      : ''
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const role = localStorage.getItem('nyaya_user_role')
    if (token) {
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (role === 'officer') {
        navigate('/officerdash', { replace: true })
      } else if (role === 'user') {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      setLoading(true)
      const res = await authApi.loginAdmin({ identifier: identifier.trim(), password })
      const { token, user } = res.data

      // Role check: Only admin accounts permitted
      if (user?.role && user.role !== 'admin') {
        setError('These credentials cannot be used for Admin Login.')
        return
      }

      const storage = remember ? localStorage : sessionStorage
      storage.setItem('token', token)
      localStorage.setItem('token', token)
      if (user?.username) {
        localStorage.setItem('nyaya_logged_user', user.username)
        localStorage.setItem('nyaya_user_name', user.fullName || user.username)
      }
      if (user?.role) {
        localStorage.setItem('nyaya_user_role', user.role)
      }
      if (user?.verificationStatus) {
        localStorage.setItem('nyaya_verification_status', user.verificationStatus)
      }

      dispatch(setCredentials({ user, token }))

      const from = location.state?.from?.pathname || '/admin/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check your admin credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(40, 20, 15, 0.55), rgba(20, 10, 8, 0.75)), url(${bg})`,
      }}
    >
      <div className="w-full max-w-md bg-[#FAF5EE]/95 rounded-2xl shadow-2xl border border-[#e6d7b8] p-8 md:p-10 backdrop-blur-xs">
        {/* Logo and heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block hover:opacity-90 transition">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img src={logo} alt="NyayaStack" className="h-10 w-10 object-contain" />
              <span className="font-bold text-2xl text-[#7a1620]" style={{ fontFamily: "'Cinzel', serif" }}>
                NyayaStack
              </span>
            </div>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold mb-2">
            <i className="fa-solid fa-shield-halved"></i> Institutional Administrator Portal
          </div>
          <h2 className="text-2xl font-bold text-[#3b2a20] font-serif">Admin Login</h2>
          <p className="text-xs text-[#3b2a20]/80 mt-1">
            Access to authority approvals and institutional oversight
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 text-xs font-bold">×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#3b2a20] mb-1">
              Admin Username or Official Email
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@nyayastack.gov.in"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1620]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3b2a20] mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1620] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-[#3b2a20]/90">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-stone-300 text-[#7a1620] focus:ring-[#7a1620]"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-[#7a1620] font-semibold hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold transition disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In to Admin Console'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-200/80 text-center space-y-2">
          <p className="text-xs text-[#3b2a20]/80">
            Authority Officer?{' '}
            <Link to="/authority-login" className="text-[#7a1620] font-semibold hover:underline">
              Authority Login
            </Link>
          </p>
          <p className="text-xs text-[#3b2a20]/80">
            Student or Standard User?{' '}
            <Link to="/login" className="text-[#7a1620] font-semibold hover:underline">
              User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
