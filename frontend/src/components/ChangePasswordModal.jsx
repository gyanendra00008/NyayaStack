import React, { useState } from 'react';
import { authApi } from '../services/api';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword) {
      return setError('Please enter your current password.');
    }
    if (newPassword.length < 8) {
      return setError('New password must be at least 8 characters long.');
    }
    if (newPassword === oldPassword) {
      return setError('New password must be different from your current password.');
    }
    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match.');
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword({
        oldPassword,
        newPassword,
      });

      setSuccess(res.data?.message || 'Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to change password. Please check your current password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#fdf8ec] rounded-2xl border border-[#e6d7b8] shadow-2xl p-6 sm:p-8 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1"
          title="Close"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#7a1620] text-white flex items-center justify-center text-sm shadow-sm">
            <i className="fa-solid fa-key"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold font-serif text-[#3b2a20]">Change Password</h2>
            <p className="text-xs text-stone-500">Update your account credentials</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
            <i className="fa-solid fa-check"></i>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#3b2a20] mb-1">
              Current Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              placeholder="Enter your current password"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white text-sm text-[#3b2a20] border border-[#e6d7b8] focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3b2a20] mb-1">
              New Password (minimum 8 characters)
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Enter new password"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white text-sm text-[#3b2a20] border border-[#e6d7b8] focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3b2a20] mb-1">
              Confirm New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white text-sm text-[#3b2a20] border border-[#e6d7b8] focus:outline-none focus:border-[#7a1620] focus:ring-1 focus:ring-[#7a1620]"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-600">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="rounded accent-[#7a1620]"
              />
              Show passwords
            </label>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg border border-[#e6d7b8] bg-white text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-[#7a1620] hover:bg-[#5e1018] text-white text-xs font-semibold transition disabled:opacity-60 shadow-sm"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
