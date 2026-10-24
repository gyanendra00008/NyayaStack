import { useState, useEffect, useRef } from 'react';

const PetitionDetails = () => {
  const [slaSeconds, setSlaSeconds] = useState(5025);
  const [chatInput, setChatInput] = useState('');
  const [description, setDescription] = useState('Enter the description of the problem here.');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const descRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      from: 'icc',
      name: 'ICC Officer #04',
      text: 'Please provide the specific date and timing when the incident occurred so we can requisition campus security footage from Gate No. 2.',
      time: '12 Oct, 3:00 PM',
      attachment: null
    },
    {
      from: 'user',
      text: 'It occurred on 8th Oct near Gate 2 at approximately 7:15 PM. Attaching the photograph of the vehicle involved.',
      time: '12 Oct, 3:12 PM',
      attachment: { name: 'vehicle_proof.png', size: '1.2 MB', icon: 'fa-image' }
    }
  ]);
  const chatStreamRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlaSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isEditingDesc && descRef.current) {
      descRef.current.focus();
    }
  }, [isEditingDesc]);

  const formatSla = (totalSeconds) => {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  const handleChatSubmit = (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setMessages(prev => [...prev, { from: 'user', text, time: 'Just now', attachment: null }]);
    setChatInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        from: 'icc',
        name: 'ICC Officer #04',
        text: 'Acknowledged. Your communication has been officially appended to Docket #NY-1048.',
        time: 'Just now',
        attachment: null
      }]);
    }, 1100);
  };

  const sendQuickPrompt = (promptText) => {
    setMessages(prev => [...prev, { from: 'user', text: promptText, time: 'Just now', attachment: null }]);
  };

  const attachFileToChat = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMessages(prev => [...prev, {
      from: 'user',
      text: 'Uploaded an attachment:',
      time: 'Just now',
      attachment: { name: file.name, size: `${(file.size / 1024).toFixed(0)} KB`, icon: 'fa-paperclip' }
    }]);
  };

  return (
    <div className="text-stone-800 flex min-h-screen w-full antialiased" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}>
      <aside className="w-64 min-h-screen bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <a href="/dashboard" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "Cinzel, serif" }}>NyayaStack</span>
          </a>
          <nav className="p-4 space-y-1 text-xs font-semibold">
            <a href="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-house w-4"></i> Dashboard</a>
            <a href="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-file-circle-plus w-4 text-[#6B1724]"></i> File a Complaint</a>
            <a href="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-folder-open w-4"></i> My Petitions</a>
            <a className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm"><i className="fa-solid fa-comments w-4"></i> Inquiry Chat</a>
            <a href="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger</a>
            <a href="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition"><i className="fa-solid fa-chart-pie w-4"></i> Public Transparency</a>
          </nav>
        </div>
        <div className="p-4 border-t border-stone-200/80 bg-[#F0E8DC] text-xs">Merkle Tree Verified</div>
      </aside>

      <main className="flex-1 min-h-screen w-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <a href="/my-petitions" className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-[#6B1724] hover:text-white flex items-center justify-center text-xs transition"><i className="fa-solid fa-arrow-left"></i></a>
            <div>
              <div className="flex items-center gap-2"><h1 className="text-base font-bold text-stone-800 font-mono">Petition #NY-1048</h1><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">High Priority</span></div>
              <p className="text-[11px] text-stone-400">Assigned to Internal Complaints Committee (ICC) • SLA Monitored</p>
            </div>
          </div>
          <a href="/ledger" className="px-3.5 py-1.5 bg-[#FAF5EE] border border-stone-300 rounded-xl text-xs font-semibold text-[#6B1724]">SHA-256 Ledger</a>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h2 className="font-bold text-stone-800 text-sm">Complaint Details</h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold"><i className="fa-solid fa-shield"></i> Merkle Verified</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-stone-400 block text-[10px]">Category:</span><span className="font-bold text-stone-800">Harassment & Safety</span></div>
                <div><span className="text-stone-400 block text-[10px]">Filed On:</span><span className="font-bold text-stone-800">12 Oct 2026, 10:30 AM</span></div>
                <div><span className="text-stone-400 block text-[10px]">Anonymous:</span><span className="font-bold text-emerald-700">Yes (Concealed)</span></div>
              </div>

              {/* ===== YAHAN CHANGE KIYA - AB ACTIVE HAI ===== */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="complaintDesc" className="text-stone-600 block text-[11px] font-bold">Description:</label>
                  {!isEditingDesc && (
                    <button onClick={() => setIsEditingDesc(true)} className="text-[11px] text-[#6B1724] font-semibold hover:underline flex items-center gap-1">
                      <i className="fa-solid fa-pen"></i> Edit
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      id="complaintDesc"
                      ref={descRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-3.5 rounded-xl border-2 border-[#6B1724] bg-white text-stone-800 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 min-h-[110px] resize-y"
                      placeholder="Enter the description of the problem here."
                      rows={4}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsEditingDesc(false)} className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 hover:bg-stone-100">Cancel</button>
                      <button onClick={() => { setIsEditingDesc(false); alert('Description saved: ' + description); }} className="px-4 py-1.5 text-xs rounded-lg bg-[#6B1724] text-white hover:bg-[#54121C] font-semibold">Save</button>
                    </div>
                  </div>
                ) : (
                  <p onClick={() => setIsEditingDesc(true)} className="bg-[#FAF5EE] p-3.5 rounded-xl border border-stone-200 text-stone-700 leading-relaxed cursor-text hover:border-[#6B1724]/30 transition min-h-[52px]">
                    {description || <span className="text-stone-400 italic">Click to enter description...</span>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-stone-400 text-[10px]">Attachments:</span>
                <span className="px-2.5 py-1 bg-stone-100 rounded-lg text-[11px] font-mono border"><i className="fa-solid fa-file-pdf text-rose-600"></i> proof1.pdf</span>
                <span className="px-2.5 py-1 bg-stone-100 rounded-lg text-[11px] font-mono border"><i className="fa-solid fa-image text-indigo-600"></i> gate2_photo.png</span>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between text-center">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase">SLA Timer</span>
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border animate-pulse">Live Enforced</span>
                </div>
                <div className="w-24 h-24 mx-auto my-2 rounded-full border-4 border-rose-100 border-t-rose-600 flex flex-col items-center justify-center bg-rose-50/20">
                  <span className="font-mono font-extrabold text-base text-rose-600">{formatSla(slaSeconds)}</span>
                  <span className="text-[8px] text-rose-400 uppercase">remaining</span>
                </div>
              </div>
              <div className="text-xs bg-[#FAF5EE] p-3 rounded-xl border"><span className="text-stone-400 block text-[10px]">Current Stage:</span><p className="font-bold text-amber-700">In Review</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-xs uppercase text-stone-400 border-b pb-2.5">Status Timeline</h3>
              <p className="text-xs mt-3">Filed → Assigned → In Review (Current)</p>
            </div>
            <div className="lg:col-span-7 bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden">
              <div className="p-3.5 border-b bg-[#FAF5EE] flex justify-between text-xs"><span className="font-bold">Inquiry Chat - #NY-1048</span><span className="text-[10px] text-[#6B1724] bg-rose-100 px-2 py-0.5 rounded">Secure Channel</span></div>
              <div ref={chatStreamRef} className="p-4 space-y-3 overflow-y-auto max-h-80 text-xs">
                {messages.map((msg, idx) => (
                  <div key={idx} className={msg.from === 'icc' ? 'text-left' : 'text-right'}>
                    <div className={`inline-block p-3 rounded-2xl ${msg.from === 'icc' ? 'bg-stone-100' : 'bg-[#6B1724] text-white'}`}>{msg.text}</div>
                    <div className="text-[9px] text-stone-400 mt-1">{msg.time}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleChatSubmit} className="p-3 border-t flex gap-2 bg-[#FAF5EE]/70">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type your response..." className="flex-1 px-3.5 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#6B1724] bg-white" />
                <button type="submit" className="px-4 py-2 bg-[#6B1724] text-white text-xs rounded-xl">Send</button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PetitionDetails;