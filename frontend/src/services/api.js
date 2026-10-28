import axios from 'axios';

// Resolve API base URL strictly from environment variables
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    console.warn('VITE_API_URL or VITE_API_BASE_URL is not defined in environment variables.');
    return '';
  }
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

// Centralized Axios instance with environment-aware baseURL and credentials
const api = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor: Attach JWT bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Centralized error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear expired credentials
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Standard grievance categories matching backend schema & ML model
export const DEFAULT_CATEGORIES = [
  'Hostel',
  'Academic',
  'Infrastructure',
  'Administration',
  'Finance',
  'Harassment',
  'Ragging',
  'Discipline',
  'Mess',
  'Transport',
  'Medical',
  'Other',
];

// Authentication API methods
export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  registerAuthority: (payload) => api.post('/auth/authority/register', payload),
  verifyOtp: (payload) => api.post('/auth/verify-otp', payload),
  resendOtp: (payload) => api.post('/auth/resend-otp', payload),
  login: (payload) => api.post('/auth/login', payload),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  verifyResetOtp: (payload) => api.post('/auth/verify-reset-otp', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  getMe: () => api.get('/auth/me'),
  getAdminDashboard: () => api.get('/auth/admin/dashboard'),
};

// Administrator API methods
export const adminApi = {
  getAuthorityRequests: (params = {}) => api.get('/admin/authority-requests', { params }),
  getAuthorityRequestById: (id) => api.get(`/admin/authority-requests/${id}`),
  approveAuthorityRequest: (id) => api.patch(`/admin/authority-requests/${id}/approve`),
  rejectAuthorityRequest: (id, reason) => api.patch(`/admin/authority-requests/${id}/reject`, { reason }),
  getStats: () => api.get('/admin/dashboard'),
  // Hash-chain: admin can resolve an entire chain from any complaint in it
  resolveChain: (complaintId) => api.patch(`/admin/complaints/${complaintId}/resolve-chain`),
};

// Health API methods
export const healthApi = {
  getHealth: () => api.get('/health'),
};

// Complaint & Petition API methods
export const complaintApi = {
  getCategories: () => api.get('/complaints/categories'),
  predictCategory: (payload) => api.post('/complaints/predict-category', payload),
  getPublicStats: async () => {
    try {
      const res = await api.get('/complaints/public/stats');
      return res;
    } catch (err) {
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
          return await axios.get('http://localhost:3000/api/complaints/public/stats', { timeout: 3000 });
        } catch {
          // fallback
        }
      }
      throw err;
    }
  },
  getPublicComplaints: async (params = {}) => {
    try {
      const res = await api.get('/complaints/public', { params });
      return res;
    } catch (err) {
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
          return await axios.get('http://localhost:3000/api/complaints/public', { params, timeout: 3000 });
        } catch {
          // fallback
        }
      }
      throw err;
    }
  },
  createComplaint: (formData) =>
    api.post('/complaints', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  getMyComplaints: (params = {}) => api.get('/complaints/my', { params }),
  getAssignedComplaints: (params = {}) => api.get('/complaints/assigned', { params }),
  updateComplaintStatus: (complaintId, payload) => api.patch(`/complaints/${complaintId}/status`, payload),
  getComplaintById: (complaintId) => api.get(`/complaints/${complaintId}`),
  // Hash-chain endpoints
  getComplaintChain: (complaintId) => api.get(`/complaints/${complaintId}/chain`),
  resolveComplaintChain: (complaintId) => api.patch(`/complaints/${complaintId}/resolve-chain`),
};

export default api;
