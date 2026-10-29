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

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Unverified user OTP verification modal state
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpMessage, setOtpMessage] = useState('')
  const [otpError, setOtpError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authApi.login({
        identifier: identifier.trim(),
        password,
      })

      const { token, user } = response.data
      if (token) {
        localStorage.setItem('token', token)
      }
      if (user?.username) {
        localStorage.setItem('nyaya_logged_user', user.username)
        localStorage.setItem('nyaya_user_name', user.fullName || user.username)
      }
      if (user?.rollNo) {
        localStorage.setItem('nyaya_user_roll', user.rollNo)
      }
      if (user?.role) {
        localStorage.setItem('nyaya_user_role', user.role)
      }

      dispatch(setCredentials({ user, token }))

      const from =
        location.state?.from?.pathname ||
        (user?.role === 'officer' || user?.role === 'admin' ? '/officerdash' : '/dashboard')
      navigate(from, { replace: true })
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message || err.message || 'Login failed. Please verify your credentials.'

      if (status === 403 && msg.toLowerCase().includes('not verified')) {
        // User has registered but has not yet verified email OTP
        setOtpEmail(identifier.trim())
        setShowOtpModal(true)
        setError('')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    setOtpMessage('')
    setOtpLoading(true)

    try {
      const response = await authApi.verifyOtp({
        email: otpEmail,
        otp: otpCode.trim(),
      })

      const { token, user } = response.data
      if (token) {
        localStorage.setItem('token', token)
      }
      if (user?.username) {
        localStorage.setItem('nyaya_logged_user', user.username)
        localStorage.setItem('nyaya_user_name', user.fullName || user.username)
      }
      if (user?.rollNo) {
        localStorage.setItem('nyaya_user_roll', user.rollNo)
      }
      if (user?.role) {
        localStorage.setItem('nyaya_user_role', user.role)
      }

      dispatch(setCredentials({ user, token }))
      setShowOtpModal(false)
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      setOtpError(err.response?.data?.message || err.message || 'OTP verification failed.')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setOtpError('')
    setOtpMessage('')
    try {
      await authApi.resendOtp({ email: otpEmail })
      setOtpMessage('A new 6-digit OTP code has been dispatched to your email.')
    } catch (err) {
      setOtpError(err.response?.data?.message || err.message || 'Could not resend OTP. Please try again.')
    }
  }

  const handleInstituteLogin = () => {
    // Demo Institute SSO auto-fill
    setIdentifier('student@nyayastack.ac.in')
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

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Email / Username */}
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-[#3b2a20] mb-1">
              Email / Username
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="Enter email or username"
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
            disabled={loading}
            className={`w-full py-2.5 rounded-lg bg-[#7a1620] text-white font-semibold transition flex items-center justify-center gap-2 ${
              loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#5e1018]'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Logging in...</span>
              </>
            ) : (
              'Login'
            )}
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

      {/* OTP Verification Modal for unverified accounts */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#fdf8ec] rounded-2xl border border-[#e6d7b8] shadow-2xl p-6">
            <h3 className="text-lg font-bold text-[#7a1620] font-serif text-center">Verify Your Account</h3>
            <p className="text-xs text-stone-600 text-center mt-1">
              Your account is pending verification. Please enter the 6-digit code sent to:
            </p>
            <p className="text-xs font-semibold text-center text-stone-800 font-mono mt-0.5">{otpEmail}</p>

            {otpMessage && (
              <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
                {otpMessage}
              </div>
            )}
            {otpError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full text-center tracking-[0.5em] font-mono text-lg py-2 rounded-lg border border-[#e6d7b8] bg-white focus:outline-none focus:border-[#7a1620]"
                />
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpCode.length !== 6}
                className="w-full py-2 bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold rounded-lg text-sm transition disabled:opacity-60"
              >
                {otpLoading ? 'Verifying...' : 'Verify & Log In'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-[#7a1620] hover:underline font-medium"
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="text-stone-500 hover:text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
