import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintApi, DEFAULT_CATEGORIES } from '../services/api';
import UserSidebar from '../components/UserSidebar';

const FileComplaint = () => {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const [formData, setFormData] = useState({
    category: 'Hostel',
    department: 'Hostel & Mess',
    priority: 'Medium (Standard SLA 48h)',
    isAnon: false,
    isEmergency: false,
    subject: '',
    desc: ''
  });

  // Array of actual File instances
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Stale request, duplicate prevention, and cancellation refs for Gemini API calls
  const latestRequestIdRef = useRef(0);
  const activeAbortControllerRef = useRef(null);
  const lastClassifiedInputRef = useRef({ title: '', description: '' });
  const quotaExhaustedRef = useRef(false);

  // Manual vs Auto ML category state
  const [isManualCategory, setIsManualCategory] = useState(false);

  // AI Category suggestion state
  const [mlLoading, setMlLoading] = useState(false);
  const [mlSuggestion, setMlSuggestion] = useState(null);
  const [mlStale, setMlStale] = useState(false);
  const [mlError, setMlError] = useState('');

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [existingTitles, setExistingTitles] = useState([]);
  const [todayComplaintsCount, setTodayComplaintsCount] = useState(0);

  // Hash-chain state
  const [myComplaints, setMyComplaints] = useState([]);
  const [linkToExisting, setLinkToExisting] = useState(false);
  const [parentComplaintId, setParentComplaintId] = useState('');

  // Ensure user is authenticated to access complaint upload/filing
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: { pathname: '/file-complaint' } }, replace: true });
    }
  }, [navigate]);

  // Fetch categories and user's complaints to track duplicate titles and daily limits
  useEffect(() => {
    let isMounted = true;
    complaintApi.getCategories()
      .then(res => {
        if (isMounted && res.data?.data && Array.isArray(res.data.data)) {
          setCategories(res.data.data);
          if (!res.data.data.includes(formData.category)) {
            setFormData(prev => ({ ...prev, category: res.data.data[0] }));
          }
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_CATEGORIES
      });

    // Check existing complaints by authenticated user for duplicate title and daily limit checks
    complaintApi.getMyComplaints({ limit: 50 })
      .then(res => {
        if (!isMounted) return;
        const complaintsList = res.data?.data || [];
        const titles = complaintsList.map(c => (c.title || c.subject || '').trim().toLowerCase()).filter(Boolean);
        setExistingTitles(titles);
        // Store full list for chain linking (only non-resolved complaints)
        setMyComplaints(complaintsList.filter(c => c.status !== 'Resolved' && c.status !== 'Rejected'));

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const count = complaintsList.filter(c => c.createdAt && new Date(c.createdAt) >= startOfDay).length;
        setTodayComplaintsCount(count);
      })
      .catch(() => {
        try {
          const cached = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
          const titles = cached.map(c => (c.subject || c.title || '').trim().toLowerCase()).filter(Boolean);
          setExistingTitles(titles);
        } catch (_) {}
      });

    return () => { isMounted = false; };
  }, []);

  const changeStep = (s) => {
    setValidationError('');
    if (s > 1) {
      const trimmedTitle = formData.subject.trim();
      if (!trimmedTitle || trimmedTitle.length < 3) {
        setValidationError('Subject must be at least 3 characters long.');
        return;
      }
      if (existingTitles.includes(trimmedTitle.toLowerCase())) {
        setValidationError('You have already submitted a complaint with this title. Duplicate complaints are not allowed.');
        return;
      }
      if (todayComplaintsCount >= 10) {
        setValidationError('Daily complaint limit reached. You cannot submit more than 10 complaints in a day.');
        return;
      }
      if (!formData.desc.trim() || formData.desc.trim().length < 10) {
        setValidationError('Detailed description must be at least 10 characters long.');
        return;
      }
    }
    if (s > 2) {
      const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
      if (totalSize > 10 * 1024 * 1024) {
        setValidationError('Total attachment size exceeds the 10 MB limit.');
        return;
      }
      if (files.length > 5) {
        setValidationError('A maximum of 5 attachments are allowed.');
        return;
      }
    }
    setCurrentStep(s);
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError('');
    if (field === 'subject' || field === 'desc') {
      if (mlSuggestion) {
        setMlStale(true);
      }
    }
  };

  const handleCategoryChange = (val) => {
    setIsManualCategory(true);
    setFormData(prev => ({ ...prev, category: val }));
  };

  // Cleanup pending requests on unmount
  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Shared complaint classification helper invoking the Node.js Gemini endpoint
  const performClassification = useCallback(async (title, description, isManualTrigger = false) => {
    const trimmedTitle = (title || '').trim();
    const trimmedDesc = (description || '').trim();

    // Do not trigger for empty or whitespace-only inputs
    if (!trimmedTitle || !trimmedDesc) {
      if (isManualTrigger) {
        setMlError('Please enter both a title and description before requesting AI classification.');
      }
      return;
    }

    if (trimmedTitle.length < 3) {
      if (isManualTrigger) {
        setMlError('Title must be at least 3 characters long for AI classification.');
      }
      return;
    }

    if (trimmedDesc.length < 5) {
      if (isManualTrigger) {
        setMlError('Description must be at least 5 characters long for AI classification.');
      }
      return;
    }

    // Avoid duplicate requests when title and description have not meaningfully changed
    if (!isManualTrigger) {
      if (
        lastClassifiedInputRef.current.title === trimmedTitle &&
        lastClassifiedInputRef.current.description === trimmedDesc
      ) {
        return;
      }
      // Do not automatically fire requests if quota is exhausted
      if (quotaExhaustedRef.current) {
        return;
      }
    } else {
      // Manual trigger explicitly resets the quota exhausted state
      quotaExhaustedRef.current = false;
    }

    // Cancel any previous in-flight request to ensure newer input cannot be overwritten
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    const currentRequestId = ++latestRequestIdRef.current;

    setMlLoading(true);
    setMlError('');

    try {
      const res = await complaintApi.classifyComplaint(
        {
          title: trimmedTitle,
          description: trimmedDesc,
        },
        { signal: controller.signal }
      );

      // Guard against out-of-order / stale responses
      if (currentRequestId !== latestRequestIdRef.current) return;

      lastClassifiedInputRef.current = { title: trimmedTitle, description: trimmedDesc };
      quotaExhaustedRef.current = false;
      setMlError('');

      const classification = res.data?.classification;
      if (classification && classification.category) {
        if (!isManualCategory) {
          setFormData((prev) => ({
            ...prev,
            category: classification.category,
            department: classification.department || prev.department,
          }));
        }

        setMlSuggestion({
          department: classification.department,
          category: classification.category,
          explanation: classification.explanation,
          needsHumanReview: Boolean(classification.needsHumanReview),
          // Backwards-compatible aliases
          predicted_category: classification.category,
          needs_review: Boolean(classification.needsHumanReview),
        });
        setMlStale(false);
      }
    } catch (err) {
      // Ignore canceled errors caused by subsequent keystrokes
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      if (currentRequestId !== latestRequestIdRef.current) return;

      if (err.response?.status === 429 || err.response?.data?.code === 'AI_QUOTA_EXHAUSTED') {
        quotaExhaustedRef.current = true;
      }

      const msg =
        err.response?.data?.message ||
        err.message ||
        'AI classification service is temporarily unavailable. Please select a category manually.';
      setMlError(msg);
    } finally {
      if (currentRequestId === latestRequestIdRef.current) {
        setMlLoading(false);
      }
    }
  }, [isManualCategory]);

  // Debounced automatic classification via Gemini API as user enters title & description
  useEffect(() => {
    const trimmedTitle = formData.subject.trim();
    const trimmedDesc = formData.desc.trim();

    if (isManualCategory) return;
    // Only auto-trigger when both title and description have meaningful input
    if (trimmedTitle.length < 3 || trimmedDesc.length < 5) return;

    const timer = setTimeout(() => {
      performClassification(trimmedTitle, trimmedDesc, false);
    }, 700);

    return () => clearTimeout(timer);
  }, [formData.subject, formData.desc, isManualCategory, performClassification]);

  const handleSuggestCategory = () => {
    performClassification(formData.subject, formData.desc, true);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    setValidationError('');
    const merged = [...files, ...selected];
    if (merged.length > 5) {
      setValidationError('You can attach a maximum of 5 files.');
      setFiles(merged.slice(0, 5));
    } else {
      setFiles(merged);
    }

    // Reset input value so same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setValidationError('');
  };

  const submitPetitionAction = async () => {
    setValidationError('');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to submit a complaint. Redirecting to login.');
      navigate('/login');
      return;
    }

    const trimmedTitle = formData.subject.trim();
    const trimmedDesc = formData.desc.trim();

    if (trimmedTitle.length < 3) {
      setValidationError('Subject must be at least 3 characters long.');
      setCurrentStep(1);
      return;
    }
    if (trimmedDesc.length < 10) {
      setValidationError('Description must be at least 10 characters long.');
      setCurrentStep(1);
      return;
    }

    if (existingTitles.includes(trimmedTitle.toLowerCase())) {
      setValidationError('You have already submitted a complaint with this title. Duplicate complaints are not allowed.');
      setCurrentStep(1);
      return;
    }

    if (todayComplaintsCount >= 10) {
      setValidationError('Daily complaint limit reached. You cannot submit more than 10 complaints in a day.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('category', formData.category);
      if (formData.department) {
        fd.append('department', formData.department);
      }
      fd.append('title', trimmedTitle);
      fd.append('description', trimmedDesc);
      fd.append('isAnonymous', formData.isAnon ? 'true' : 'false');

      // Hash-chain: attach parent complaint ID if user linked this to an existing one
      if (linkToExisting && parentComplaintId) {
        fd.append('parentComplaintId', parentComplaintId);
      }

      files.forEach((file) => {
        fd.append('attachments', file);
      });

      const response = await complaintApi.createComplaint(fd);
      const savedData = response.data?.data;
      const complaintId = savedData?.complaintId || `#NY-${Math.floor(1051 + Math.random() * 50)}`;

      // Update local storage cache for compatibility with other views
      let existing = [];
      try {
        existing = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
      } catch (e) {
        existing = [];
      }
      existing.unshift({
        id: complaintId,
        category: savedData?.category || formData.category,
        priority: formData.priority,
        subject: savedData?.title || trimmedTitle,
        desc: savedData?.description || trimmedDesc,
        status: savedData?.status || 'Filed',
        isAnonymous: savedData?.isAnonymous ?? formData.isAnon,
        time: 'Just now',
        attachments: savedData?.attachments || []
      });
      localStorage.setItem('nyaya_user_petitions', JSON.stringify(existing));

      alert(`Petition ${complaintId} Registered Successfully!`);
      navigate('/my-petitions');
    } catch (err) {
      if (err.response?.status === 401) {
        alert('Your session has expired. Please log in again.');
        navigate('/login');
        return;
      }
      const msg = err.response?.data?.message || err.message || 'Failed to submit petition. Please try again.';
      setValidationError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const badgeClass = (step) =>
    currentStep === step
      ? "px-3 py-1.5 rounded-full bg-[#6B1724] text-white"
      : "px-3 py-1.5 rounded-full bg-stone-200 text-stone-600";

  return (
    <div className="text-stone-800 flex h-dvh w-full overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {navOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* USER SIDEBAR */}
      <UserSidebar navOpen={navOpen} setNavOpen={setNavOpen} />

      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-[#FAF7F2] w-full">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm w-full">
          <div><h1 className="text-lg font-bold">File a New Complaint</h1><p className="text-xs text-stone-500">AI-Assisted Classification with SLA timer enforcement</p></div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button onClick={() => changeStep(1)} className={badgeClass(1)}>1. Details</button><span className="text-stone-300">→</span>
            <button onClick={() => changeStep(2)} className={badgeClass(2)}>2. Attachments</button><span className="text-stone-300">→</span>
            <button onClick={() => changeStep(3)} className={badgeClass(3)}>3. Review</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full h-full bg-[#FAF7F2]">
          <div className="p-6 md:p-8 w-full h-full flex flex-col">
            {validationError && (
              <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
                  <span>{validationError}</span>
                </div>
                <button onClick={() => setValidationError('')} className="text-rose-500 hover:text-rose-800 text-xs font-bold">×</button>
              </div>
            )}

            {currentStep === 1 && (
              <div className="bg-white p-8 md:p-10 rounded-2xl border border-stone-200/80 shadow-sm w-full min-h-[80vh] flex flex-col space-y-6">
                <div className="border-b border-stone-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xl">Step 1: Enter Grievance Details</h3>
                    <p className="text-sm text-stone-400 mt-1">Describe the issue clearly for automated clustering and fast assignment</p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`text-xs px-3 py-1.5 rounded-xl font-semibold border flex items-center gap-1.5 shadow-xs ${
                      todayComplaintsCount >= 10
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : todayComplaintsCount >= 8
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}>
                      <i className={`fa-solid fa-calendar-day ${todayComplaintsCount >= 10 ? 'text-rose-600' : 'text-stone-400'}`}></i>
                      <span>Daily Quota: <strong>{todayComplaintsCount}/10</strong> used</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSuggestCategory}
                      disabled={mlLoading}
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-[#7a1620] border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-2 self-start md:self-auto shadow-xs disabled:opacity-60"
                    >
                      {mlLoading ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>AI Analyzing Grievance...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-wand-magic-sparkles text-amber-600"></i>
                          <span>Suggest Category (AI)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Classification Feedback Banner */}
                {mlLoading && (
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-center gap-2 shadow-xs">
                    <i className="fa-solid fa-spinner fa-spin text-amber-600 text-sm"></i>
                    <span className="font-medium">Analyzing complaint with Gemini AI...</span>
                  </div>
                )}

                {!mlLoading && mlSuggestion && (
                  <div className={`p-4 rounded-xl border text-xs flex flex-col gap-2.5 shadow-xs transition-all ${
                    mlSuggestion.needsHumanReview
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 border-stone-200/60">
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${mlSuggestion.needsHumanReview ? 'fa-triangle-exclamation text-amber-600' : 'fa-circle-check text-emerald-600'} text-sm`}></i>
                        <span className="font-bold text-sm">AI Complaint Classification</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {mlSuggestion.needsHumanReview ? (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            Human Review Recommended
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <i className="fa-solid fa-check"></i>
                            Automated Match
                          </span>
                        )}
                        {mlStale && (
                          <span className="text-[11px] text-stone-500 italic">
                            (Input changed)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5 text-xs">
                      <div className="bg-white/70 p-2.5 rounded-lg border border-stone-200/70">
                        <span className="text-stone-500 font-semibold block text-[11px]">AI-Predicted Department:</span>
                        <strong className="text-stone-900 text-xs block mt-0.5">{mlSuggestion.department || 'Administration'}</strong>
                      </div>
                      <div className="bg-white/70 p-2.5 rounded-lg border border-stone-200/70">
                        <span className="text-stone-500 font-semibold block text-[11px]">AI-Predicted Category:</span>
                        <strong className="text-[#6B1724] text-xs block mt-0.5">{mlSuggestion.category}</strong>
                      </div>
                    </div>

                    {mlSuggestion.explanation && (
                      <div className="text-xs pt-1.5 border-t border-stone-200/60 text-stone-700">
                        <strong className="font-semibold text-stone-800">Reason: </strong>
                        <span>{mlSuggestion.explanation}</span>
                      </div>
                    )}

                    {mlSuggestion.needsHumanReview && (
                      <div className="text-[11px] text-amber-900 bg-amber-100/80 p-2.5 rounded-lg flex items-center gap-2 mt-0.5 border border-amber-200">
                        <i className="fa-solid fa-triangle-exclamation text-amber-600 shrink-0"></i>
                        <span>This classification may require human review. You can also manually adjust the category below.</span>
                      </div>
                    )}
                  </div>
                )}

                {mlError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
                      <span>{mlError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSuggestCategory}
                      className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline ml-2 shrink-0 cursor-pointer"
                    >
                      Retry AI Classification
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block font-semibold">
                        Grievance Category *
                      </label>
                      {isManualCategory ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsManualCategory(false);
                            handleSuggestCategory();
                          }}
                          className="text-[11px] text-[#6B1724] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <i className="fa-solid fa-rotate-left"></i>
                          Revert to AI Auto-Detection
                        </button>
                      ) : (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <i className="fa-solid fa-robot"></i> Auto-Classified by Gemini AI
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border bg-white focus:outline-none ${
                        isManualCategory
                          ? 'border-amber-300 focus:border-[#6B1724]'
                          : 'border-emerald-300 focus:border-[#6B1724]'
                      }`}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-stone-500 mt-1">
                      {isManualCategory
                        ? 'Manual selection active. The AI classifier will not overwrite your chosen category.'
                        : 'Category and department are automatically classified by Gemini as you enter the title and description. You can also pick a category manually.'}
                    </p>
                  </div>
                  <div>
                    <label className="block font-semibold mb-2">Priority Level</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => handleFieldChange('priority', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-[#6B1724]"
                    >
                      <option>Medium (Standard SLA 48h)</option>
                      <option>High (Strict SLA 24h)</option>
                      <option>Low (Informational SLA 72h)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isAnon}
                      onChange={(e) => handleFieldChange('isAnon', e.target.checked)}
                      className="w-4 h-4 accent-[#6B1724]"
                    />
                    File Anonymously
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isEmergency}
                      onChange={(e) => handleFieldChange('isEmergency', e.target.checked)}
                      className="w-4 h-4 accent-[#6B1724]"
                    />
                    Emergency Flag
                  </label>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold">Subject / Summary *</label>
                    <span className="text-[11px] text-stone-400">{formData.subject.length}/200</span>
                  </div>
                  <input
                    type="text"
                    maxLength={200}
                    value={formData.subject}
                    onChange={(e) => handleFieldChange('subject', e.target.value)}
                    placeholder="Enter short summary of the grievance (e.g. Geyser not functioning in hostel Block B)"
                    className={`w-full px-4 py-3 text-sm rounded-xl border focus:outline-none ${
                      formData.subject.trim() && existingTitles.includes(formData.subject.trim().toLowerCase())
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-600'
                        : 'border-stone-300 focus:border-[#6B1724]'
                    }`}
                  />
                  {formData.subject.trim() && existingTitles.includes(formData.subject.trim().toLowerCase()) && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1.5">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>You have already submitted a complaint with this title. Duplicate complaints are not allowed.</span>
                    </p>
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold">Detailed Description *</label>
                    <span className="text-[11px] text-stone-400">{formData.desc.length}/5000</span>
                  </div>
                  <textarea
                    maxLength={5000}
                    value={formData.desc}
                    onChange={(e) => handleFieldChange('desc', e.target.value)}
                    placeholder="Describe your issue with all necessary details (location, dates, nature of the issue)..."
                    className="w-full flex-1 p-4 text-sm rounded-xl border border-stone-300 min-h-[220px] focus:outline-none focus:border-[#6B1724]"
                  ></textarea>
                </div>

                {/* ── Hash-Chain Section ─────────────────────────────────── */}
                <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-link text-[#6B1724] text-sm"></i>
                      <span className="text-sm font-semibold">Link to Existing Complaint (Hash Chain)</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-600">
                      <input
                        type="checkbox"
                        checked={linkToExisting}
                        onChange={(e) => {
                          setLinkToExisting(e.target.checked);
                          if (!e.target.checked) setParentComplaintId('');
                        }}
                        className="w-4 h-4 accent-[#6B1724]"
                      />
                      This complaint is related to a previous one
                    </label>
                  </div>

                  {linkToExisting && (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-500">
                        Select the complaint this one is directly related to. When any complaint in the chain is resolved by the authority, all linked complaints will be automatically marked as resolved together.
                      </p>
                      {myComplaints.length === 0 ? (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
                          <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                          <span>You have no active complaints to link to. Submit at least one complaint first.</span>
                        </div>
                      ) : (
                        <select
                          value={parentComplaintId}
                          onChange={(e) => setParentComplaintId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:border-[#6B1724]"
                        >
                          <option value="">— Select parent complaint to chain —</option>
                          {myComplaints.map((c) => (
                            <option key={c.complaintId} value={c.complaintId}>
                              [{c.complaintId}] {c.title || c.subject} ({c.status})
                            </option>
                          ))}
                        </select>
                      )}

                      {parentComplaintId && (
                        <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-4 py-3 flex items-center gap-2">
                          <i className="fa-solid fa-link text-indigo-600"></i>
                          <span>
                            This complaint will be chained with <strong>{parentComplaintId}</strong>. When an authority marks any linked issue as Resolved, all issues in this chain will automatically be resolved!
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => changeStep(2)}
                    className="px-8 py-3 bg-[#6B1724] hover:bg-[#54121C] text-white text-sm font-semibold rounded-xl shadow transition"
                  >
                    Next: Attachments →
                  </button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-white p-8 md:p-10 rounded-2xl border border-stone-200/80 shadow-sm w-full min-h-[80vh] flex flex-col">
                <div className="border-b border-stone-100 pb-4 mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xl">Step 2: Upload Supporting Evidence</h3>
                    <p className="text-sm text-stone-400 mt-1">Attach photos, documents, or screenshots (Max 5 files, 10MB total)</p>
                  </div>
                  <span className="text-xs bg-rose-100 text-[#6B1724] px-3 py-1.5 rounded-lg font-bold">
                    <span>{files.length}</span> / 5 Attached
                  </span>
                </div>

                <div
                  onClick={() => fileInputRef.current.click()}
                  className="border-2 border-dashed border-stone-300 hover:border-[#6B1724] rounded-2xl p-16 text-center cursor-pointer bg-stone-50/50 hover:bg-stone-50 flex-1 flex flex-col items-center justify-center min-h-[300px] transition"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*,.pdf,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-full bg-rose-50 text-[#6B1724] flex items-center justify-center text-2xl mb-4">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <p className="text-sm font-bold">Click to upload or drag & drop files here</p>
                  <p className="text-xs text-stone-400 mt-2">PNG, JPG, PDF, MP4 (Max 10 MB total quota)</p>
                </div>

                {files.length > 0 && (
                  <div className="space-y-3 pt-6">
                    {files.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-white text-sm shadow-xs">
                        <div className="flex items-center gap-3">
                          <i className={`fa-solid ${f.type?.includes('image') ? 'fa-image' : f.type?.includes('pdf') ? 'fa-file-pdf' : 'fa-file'} text-[#6B1724]`}></i>
                          <span className="font-bold">{f.name}</span>
                          <span className="text-xs text-stone-400">
                            {f.size ? `${(f.size / 1024).toFixed(0)} KB` : 'Attached'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-stone-400 hover:text-rose-600 transition"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-8 mt-auto">
                  <button
                    onClick={() => changeStep(1)}
                    className="px-6 py-3 border border-stone-300 hover:bg-stone-50 rounded-xl text-sm font-semibold transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => changeStep(3)}
                    className="px-8 py-3 bg-[#6B1724] hover:bg-[#54121C] text-white rounded-xl text-sm font-semibold shadow transition"
                  >
                    Next: Review →
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="bg-white p-8 md:p-10 rounded-2xl border border-stone-200/80 shadow-sm w-full min-h-[80vh] flex flex-col">
                <div className="border-b border-stone-100 pb-4 mb-6">
                  <h3 className="font-bold text-xl">Step 3: Review Your Complaint</h3>
                  <p className="text-sm text-stone-400 mt-1">Verify information before submitting to institutional redressal queue</p>
                </div>

                <div className="bg-[#FAF7F2] p-8 rounded-xl space-y-5 text-sm border border-stone-200 flex-1">
                  <div className="flex justify-between py-3 border-b border-stone-200">
                    <span className="text-stone-500 font-semibold">Category:</span>
                    <div className="text-right">
                      <span className="font-bold text-base text-[#6B1724]">{formData.category}</span>
                      <span className="block text-[11px] text-stone-500 font-normal">
                        {isManualCategory ? '✏️ Manually Selected' : '✨ Automatically Classified by Gemini AI'}
                      </span>
                    </div>
                  </div>
                  {formData.department && (
                    <div className="flex justify-between py-3 border-b border-stone-200">
                      <span className="text-stone-500 font-semibold">Department:</span>
                      <div className="text-right">
                        <span className="font-bold text-base text-stone-800">{formData.department}</span>
                        <span className="block text-[11px] text-stone-500 font-normal">
                          Grievance routing jurisdiction
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-b border-stone-200">
                    <span className="text-stone-500 font-semibold">Petitioner Privacy:</span>
                    <span className={`font-bold flex items-center gap-1.5 ${formData.isAnon ? 'text-[#6B1724]' : 'text-stone-700'}`}>
                      {formData.isAnon ? (
                        <>
                          <i className="fa-solid fa-user-secret text-[#6B1724]"></i>
                          <span>Filed Anonymously (Identity Protected)</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-user-check text-emerald-700"></i>
                          <span>Standard Student Submission</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-stone-200">
                    <span className="text-stone-500 font-semibold">Priority:</span>
                    <span className="font-medium">{formData.priority}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-stone-200">
                    <span className="text-stone-500 font-semibold">Subject:</span>
                    <span className="font-bold text-right max-w-[60%]">{formData.subject}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-stone-500 font-semibold block mb-3">Description:</span>
                    <p className="text-stone-700 bg-white p-6 rounded-xl border border-stone-200 leading-relaxed min-h-[160px] text-sm whitespace-pre-wrap">
                      {formData.desc}
                    </p>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-stone-500 font-semibold">Attachments:</span>
                    <span className="font-bold text-[#6B1724]">
                      {files.length} {files.length === 1 ? 'file' : 'files'} attached
                    </span>
                  </div>
                  {linkToExisting && parentComplaintId && (
                    <div className="flex justify-between py-3 border-t border-stone-200">
                      <span className="text-stone-500 font-semibold flex items-center gap-1.5">
                        <i className="fa-solid fa-link text-[#6B1724]"></i> Hash Chain Parent:
                      </span>
                      <span className="font-bold text-[#6B1724] font-mono">
                        {parentComplaintId}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-8 mt-auto">
                  <button
                    disabled={submitting}
                    onClick={() => changeStep(2)}
                    className="px-6 py-3 border border-stone-300 hover:bg-stone-50 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                  >
                    ← Back
                  </button>
                  <button
                    disabled={submitting}
                    onClick={submitPetitionAction}
                    className="px-8 py-3 bg-[#6B1724] hover:bg-[#54121C] text-white text-sm font-bold rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Submitting Petition...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i>
                        <span>Submit Petition</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FileComplaint;
