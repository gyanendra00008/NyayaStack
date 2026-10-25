import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import bg from '../assets/2ndbg.png';
import logo from '../assets/logo.png';

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
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Step 1 = Request OTP, Step 2 = Verify OTP, Step 3 = Set New Password, Step 4 = Success
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Step 1: Request reset OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!identifier.trim()) {
      return setError('Please enter your email address or username.');
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ identifier: identifier.trim() });
      setMessage(
        res.data?.message || 'If an account matches your details, a 6-digit reset code has been dispatched.'
      );
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to request reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify reset OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return setError('Please enter a valid 6-digit verification code.');
    }

    setLoading(true);
    try {
      const res = await authApi.verifyResetOtp({
        identifier: identifier.trim(),
        otp: trimmedOtp,
      });

      const token = res.data?.resetToken;
      if (!token) {
        throw new Error('Reset token missing from server response.');
      }

      setResetToken(token);
      setMessage('Code verified successfully. Please choose a strong new password.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 (Resend): Resend OTP
  const handleResendOtp = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ identifier: identifier.trim() });
      setMessage(res.data?.message || 'A new verification code has been dispatched.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters long.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        resetToken,
        newPassword,
      });

      setMessage(res.data?.message || 'Your password has been reset successfully.');
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Password reset failed. The reset token may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-no-repeat bg-[#f6efe6] bg-[position:center_top]"
      style={{ backgroundImage: `url(${bg})` }}
    >
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl shadow-xl border border-[#e6d7b8] p-8">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
            <img src={logo} alt="NyayaStack" className="h-full w-full object-cover scale-[1.3]" />
          </div>
          <span className="text-2xl font-bold text-[#7a1620] font-serif">NyayaStack</span>
        </div>

        {/* Progress Pills */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-stone-500">
          <span className={`px-2 py-0.5 rounded-full ${step === 1 ? 'bg-[#7a1620] text-white' : 'bg-stone-200'}`}>1. Identify</span>
          <span>→</span>
          <span className={`px-2 py-0.5 rounded-full ${step === 2 ? 'bg-[#7a1620] text-white' : 'bg-stone-200'}`}>2. Verify</span>
          <span>→</span>
          <span className={`px-2 py-0.5 rounded-full ${step >= 3 ? 'bg-[#7a1620] text-white' : 'bg-stone-200'}`}>3. Reset</span>
        </div>

        <h1 className="mt-4 text-center text-xl font-bold font-serif text-[#3b2a20]">
          {step === 1 && 'Reset Your Password'}
          {step === 2 && 'Enter Verification Code'}
          {step === 3 && 'Choose New Password'}
          {step === 4 && 'Password Reset Complete!'}
        </h1>

        <p className="text-center text-xs text-[#3b2a20]/70 mt-1 mb-5">
          {step === 1 && 'Enter your registered email address or username to receive a security code.'}
          {step === 2 && `Enter the 6-digit security code sent to your email for ${identifier}.`}
          {step === 3 && 'Enter a secure password of at least 8 characters.'}
          {step === 4 && 'Your credentials have been updated. You can now log into your account.'}
        </p>

        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            {message}
          </div>
        )}

        {/* STEP 1 FORM */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-[#3b2a20] mb-1">
                Email Address or Username
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. rollno@institute.ac.in or username"
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white text-[#3b2a20] border border-[#e6d7b8] text-sm placeholder:text-stone-400 focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
            >
              {loading ? 'Sending code...' : 'Send Reset Code'}
            </button>
          </form>
        )}

        {/* STEP 2 FORM */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-xs font-semibold text-[#3b2a20] mb-1">
                6-Digit Security Code
              </label>
              <input
                id="otp"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
                className="w-full px-4 py-2.5 text-center tracking-[0.4em] font-mono text-lg rounded-lg bg-white text-[#3b2a20] border border-[#e6d7b8] focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
            >
              {loading ? 'Verifying code...' : 'Verify Code'}
            </button>

            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="hover:underline text-stone-600"
              >
                ← Change Email
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-[#7a1620] font-semibold hover:underline"
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        {/* STEP 3 FORM */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-xs font-semibold text-[#3b2a20] mb-1">
                New Password (minimum 8 characters)
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 pr-11 rounded-lg bg-white text-[#3b2a20] border border-[#e6d7b8] text-sm placeholder:text-stone-400 focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-[#3b2a20]/60 hover:text-[#7a1620]"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#3b2a20] mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white text-[#3b2a20] border border-[#e6d7b8] text-sm placeholder:text-stone-400 focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 8}
              className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold text-sm transition disabled:opacity-60 shadow-sm"
            >
              {loading ? 'Updating password...' : 'Set New Password'}
            </button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
              <i className="fa-solid fa-check"></i>
            </div>
            <p className="text-sm text-stone-700 font-medium">
              You can now sign in using your new credentials.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white font-semibold text-sm transition shadow-sm"
            >
              Go to Login
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[#e6d7b8] text-center text-xs text-[#3b2a20]/80">
          Remembered your password?{' '}
          <Link to="/login" className="text-[#7a1620] font-semibold hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
