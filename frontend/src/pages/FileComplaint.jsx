import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const FileComplaint = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    category: 'Hostel & Mess',
    priority: 'Medium (Standard SLA 48h)',
    isAnon: true,
    isEmergency: false,
    subject: 'Write a summary about your problem here.',
    desc: 'Enter the detailed description here.'
  });
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const changeStep = (s) => {
    setCurrentStep(s);
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles.map(f => ({ name: f.name, size: f.size }))]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitPetitionAction = () => {
    const id = "#NY-" + Math.floor(1051 + Math.random() * 50);
    let existing = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
    existing.unshift({
      id,
      category: formData.category,
      priority: formData.priority,
      subject: formData.subject,
      desc: formData.desc,
      status: "Filed",
      time: "Just now"
    });
    localStorage.setItem('nyaya_user_petitions', JSON.stringify(existing));
    alert(`Petition ${id} Registered Successfully!`);
    navigate("/my-petitions");
  };

  const badgeClass = (step) =>
    currentStep === step
      ? "px-3.5 py-1.5 rounded-full bg-[#6B1724] text-white"
      : "px-3.5 py-1.5 rounded-full bg-stone-200 text-stone-600";

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased bg-[#FAF7F2]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <aside className="w-64 h-screen bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full">
          <Link to="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0"><img src={logo} alt="NyayaStack" className="h-full w-full object-cover scale-[1.3]" /></div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </Link>
          <nav className="p-4 space-y-1 text-xs font-semibold flex-1 overflow-y-auto">
            <Link to="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-house w-4"></i> Dashboard</Link>
            <Link to="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"><i className="fa-solid fa-file-circle-plus w-4"></i> File a Complaint</Link>
            <Link to="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-folder-open w-4"></i> My Petitions</Link>
            <Link to="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</Link>
            <Link to="/notifications" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-bell w-4"></i> Notifications</Link>
            <Link to="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</Link>
            <Link to="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60"><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</Link>
          </nav>
          <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC] shrink-0">
            <div className="flex items-center gap-2.5">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" alt="avatar" className="w-8 h-8 rounded-full border border-[#6B1724]" />
              <div><p className="text-xs font-bold">User</p><p className="text-[10px] text-stone-500 font-mono">enter here</p></div>
            </div>
            <Link to="/login" className="text-stone-400 hover:text-[#6B1724] p-1.5"><i className="fa-solid fa-arrow-right-from-bracket text-xs"></i></Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-[#FAF7F2] w-full">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm w-full">
          <div><h1 className="text-lg font-bold">File a New Complaint</h1><p className="text-xs text-stone-500">Intelligent categorization with SLA timer enforcement</p></div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button onClick={() => changeStep(1)} className={badgeClass(1)}>1. Details</button><span className="text-stone-300">→</span>
            <button onClick={() => changeStep(2)} className={badgeClass(2)}>2. Attachments</button><span className="text-stone-300">→</span>
            <button onClick={() => changeStep(3)} className={badgeClass(3)}>3. Review</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full h-full bg-[#FAF7F2]">
          <div className="p-6 md:p-8 w-full h-full flex flex-col">
            {currentStep === 1 && (
              <div className="bg-white p-8 md:p-10 rounded-2xl border border-stone-200/80 shadow-sm w-full min-h-[80vh] flex flex-col space-y-6">
                <div className="border-b border-stone-100 pb-4"><h3 className="font-bold text-xl">Step 1: Enter Grievance Details</h3><p className="text-sm text-stone-400 mt-1">Describe the issue clearly for automated clustering and fast assignment</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div><label className="block font-semibold mb-2">Grievance Category *</label>
                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white">
                      <option>Hostel & Mess</option><option>Academics</option><option>Exams & Results</option><option>Fees & Scholarship</option><option>Infrastructure</option><option>Transport</option><option>Harassment & Safety</option><option>Other</option>
                    </select>
                  </div>
                  <div><label className="block font-semibold mb-2">Priority Level</label>
                    <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white">
                      <option>Medium (Standard SLA 48h)</option><option>High (Strict SLA 24h)</option><option>Low (Informational SLA 72h)</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isAnon} onChange={(e) => setFormData({...formData, isAnon: e.target.checked})} className="w-4 h-4" /> File Anonymously</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isEmergency} onChange={(e) => setFormData({...formData, isEmergency: e.target.checked})} className="w-4 h-4" /> Emergency Flag</label>
                </div>
                <div><label className="block text-sm font-semibold mb-2">Subject / Summary *</label><input type="text" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full px-4 py-3 text-sm rounded-xl border border-stone-300" /></div>
                <div className="flex-1 flex flex-col"><label className="block text-sm font-semibold mb-2">Detailed Description *</label><textarea value={formData.desc} onChange={(e) => setFormData({...formData, desc: e.target.value})} className="w-full flex-1 p-4 text-sm rounded-xl border border-stone-300 min-h-[300px]"></textarea></div>
                <div className="flex justify-end pt-2"><button onClick={() => changeStep(2)} className="px-8 py-3 bg-[#6B1724] text-white text-sm font-semibold rounded-xl shadow">Next: Attachments →</button></div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-white p-8 md:p-10 rounded-2xl border border-stone-200/80 shadow-sm w-full min-h-[80vh] flex flex-col">
                <div className="border-b border-stone-100 pb-4 mb-6 flex items-center justify-between">
                  <div><h3 className="font-bold text-xl">Step 2: Upload Supporting Evidence</h3><p className="text-sm text-stone-400 mt-1">Attach photos, documents, or screenshots</p></div>
                  <span className="text-xs bg-rose-100 text-[#6B1724] px-3 py-1.5 rounded-lg font-bold"><span>{files.length}</span> Attached</span>
                </div>
                <div onClick={() => fileInputRef.current.click()} className="border-2 border-dashed border-stone-300 hover:border-[#6B1724] rounded-2xl p-20 text-center cursor-pointer bg-stone-50/50 hover:bg-stone-50 flex-1 flex flex-col items-center justify-center min-h-[400px]">
                  <input type="file" ref={fileInputRef} multiple onChange={handleFileSelect} className="hidden" />
                  <div className="w-16 h-16 rounded-full bg-rose-50 text-[#6B1724] flex items-center justify-center text-2xl mb-4"><i className="fa-solid fa-cloud-arrow-up"></i></div>
                  <p className="text-sm font-bold">Click to upload or drag & drop files here</p>
                  <p className="text-xs text-stone-400 mt-2">PNG, JPG, PDF, MP4 up to 25MB each</p>
                </div>
                <div className="space-y-3 pt-6">
                  {files.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-white text-sm file-row shadow-sm">
                      <div className="flex items-center gap-3"><i className="fa-solid fa-file text-[#6B1724]"></i><span className="font-bold">{f.name}</span><span className="text-xs text-stone-400">{(f.size/1024).toFixed(0)} KB</span></div>
                      <button onClick={() => removeFile(idx)} className="text-stone-400 hover:text-rose-600"><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-8 mt-auto"><button onClick={() => changeStep(1)} className="px-6 py-3 border rounded-xl text-sm font-semibold">← Back</button><button onClick={() => changeStep(3)} className="px-8 py-3 bg-[#6B1724] text-white rounded-xl text-sm font-semibold">Next: Review →</button></div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="bg-white p-8 md:p-10 rounded-2xl border border-stone-200/80 shadow-sm w-full min-h-[80vh] flex flex-col">
                <div className="border-b border-stone-100 pb-4 mb-6"><h3 className="font-bold text-xl">Step 3: Review Your Complaint</h3><p className="text-sm text-stone-400 mt-1">Verify information before submitting</p></div>
                <div className="bg-[#FAF7F2] p-8 rounded-xl space-y-5 text-sm border border-stone-200 flex-1">
                  <div className="flex justify-between py-3 border-b"><span className="text-stone-500 font-semibold">Category:</span><span className="font-bold text-base">{formData.category}</span></div>
                  <div className="flex justify-between py-3 border-b"><span className="text-stone-500 font-semibold">Subject:</span><span className="font-bold text-right max-w-[60%]">{formData.subject}</span></div>
                  <div className="pt-2"><span className="text-stone-500 font-semibold block mb-3">Description:</span><p className="text-stone-700 bg-white p-6 rounded-xl border leading-relaxed min-h-[200px] text-sm">{formData.desc}</p></div>
                  <div className="flex justify-between py-3"><span className="text-stone-500 font-semibold">Attachments:</span><span className="font-bold text-[#6B1724]">{files.length} files attached</span></div>
                </div>
                <div className="flex justify-between pt-8 mt-auto"><button onClick={() => changeStep(2)} className="px-6 py-3 border rounded-xl text-sm font-semibold">← Back</button><button onClick={submitPetitionAction} className="px-8 py-3 bg-[#6B1724] text-white text-sm font-bold rounded-xl shadow-lg"><i className="fa-solid fa-paper-plane"></i> Submit Petition</button></div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FileComplaint;