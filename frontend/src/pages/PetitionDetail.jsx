import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import anonymousAvatar from '../assets/anonymous-avatar.svg';
import { complaintApi } from '../services/api';

const PetitionDetails = () => {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get('id') || '#NY-1048';

  const [complaintData, setComplaintData] = useState(null);
  const [slaSeconds, setSlaSeconds] = useState(5025);
  const [chatInput, setChatInput] = useState('');
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
    if (queryId) {
      complaintApi.getComplaintById(queryId)
        .then((res) => {
          if (res.data?.data) {
            setComplaintData(res.data.data);
          }
        })
        .catch(() => {
          // Check local storage fallback
          try {
            const list = JSON.parse(localStorage.getItem('nyaya_user_petitions') || '[]');
            const found = list.find((p) => p.id === queryId || p.complaintId === queryId);
            if (found) {
              setComplaintData({
                complaintId: found.id || found.complaintId,
                title: found.subject || found.title,
                category: found.category,
                description: found.desc || found.description,
                status: found.status || 'Filed',
                attachments: found.attachments || [],
                createdAt: found.time || new Date().toISOString(),
              });
            }
          } catch (e) {}
        });
    }
  }, [queryId]);

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

  const formatSla = (totalSeconds) => {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  };

  const iccReply = () => {
    setTimeout(() => {
      setMessages(prev => [...prev, {
        from: 'icc',
        name: 'ICC Officer #04',
        text: 'Acknowledged. Your communication has been officially appended to Docket #NY-1048. Security personnel have been dispatched to verify Gate No. 2 logs.',
        time: 'Just now',
        attachment: null
      }]);
    }, 1100);
  };

  const handleChatSubmit = (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    setMessages(prev => [...prev, { from: 'user', text, time: 'Just now', attachment: null }]);
    setChatInput('');
    iccReply();
  };

  const sendQuickPrompt = (promptText) => {
    setMessages(prev => [...prev, { from: 'user', text: promptText, time: 'Just now', attachment: null }]);
    setChatInput('');
    iccReply();
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

    setTimeout(() => {
      setMessages(prev => [...prev, {
        from: 'icc',
        name: 'ICC Officer #04',
        text: `Attachment received and hashed: ${file.name}.`,
        time: 'Just now',
        attachment: null,
        isHash: true,
        fileName: file.name
      }]);
    }, 1000);
  };

  return (
    <div className="text-stone-800 flex h-screen w-screen overflow-hidden antialiased" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: '#FAF7F2' }}>
      {/* FULL SCREEN LEFT SIDEBAR */}
      <aside className="w-64 h-full bg-[#F5EFE6] border-r border-stone-200/80 flex flex-col justify-between shrink-0 select-none z-10">
        <div>
          <Link to="/" className="h-16 flex items-center gap-2.5 px-6 border-b border-stone-200/80 hover:bg-stone-100/50 transition">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-[#E8C582] flex items-center justify-center text-sm shadow-sm">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="font-bold text-lg text-[#6B1724]" style={{ fontFamily: "'Cinzel', serif" }}>NyayaStack</span>
          </Link>

          <nav className="p-4 space-y-1 text-xs font-semibold">
            <Link to="/dashboard" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-house w-4"></i> Dashboard
            </Link>
            <Link to="/file-complaint" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-file-circle-plus w-4 text-[#6B1724]"></i> File a Complaint
            </Link>
            <Link to="/my-petitions" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-folder-open w-4"></i> My Petitions
            </Link>
            <Link to="/petition-detail" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#6B1724] text-white shadow-sm">
              <i className="fa-solid fa-comments w-4"></i> Inquiry Chat
            </Link>
            <Link to="/notifications" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-bell w-4"></i> Notifications
              <span className="ml-auto bg-rose-100 text-[#6B1724] px-1.5 py-0.5 rounded-full text-[10px] font-bold">4</span>
            </Link>
            <Link to="/ledger" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-fingerprint w-4"></i> Audit Ledger
            </Link>
            <Link to="/publictrans" className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-stone-600 hover:bg-stone-200/60 transition">
              <i className="fa-solid fa-chart-pie w-4"></i> Public Transparency
            </Link>
            <div className="pt-3 border-t border-stone-200/60 mt-3">
              <Link to="/officerdash" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-amber-900 bg-amber-100/50 hover:bg-amber-100 transition text-[11px]">
                <i className="fa-solid fa-user-shield w-4 text-amber-700"></i> Switch to Officer View
              </Link>
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-stone-200/80 flex items-center justify-between bg-[#F0E8DC]">
          <div className="flex items-center gap-2.5">
            <img src={anonymousAvatar} alt="Unknown Identity" className="w-8 h-8 rounded-full object-cover border border-[#6B1724]" />
            <div>
              <p className="text-xs font-bold text-stone-800">User</p>
              <p className="text-[10px] text-stone-500 font-mono">Enter here</p>
            </div>
          </div>
          <Link to="/login" title="Logout" className="text-stone-400 hover:text-[#6B1724] p-1.5 transition">
            <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
          </Link>
        </div>
      </aside>

      {/* FULL SCREEN RIGHT CONTENT AREA */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#FAF7F2]">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-stone-200/80 px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <Link to="/my-petitions" className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-[#6B1724] hover:text-white flex items-center justify-center text-xs transition" title="Back to Petitions">
              <i className="fa-solid fa-arrow-left"></i>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-stone-800 font-mono">
                  {complaintData?.complaintId || queryId}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                  {complaintData?.status || 'Active SLA'}
                </span>
                {complaintData?.isAnonymous && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-700 flex items-center gap-1">
                    <i className="fa-solid fa-user-secret"></i> Anonymous Docket
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                {complaintData?.title || 'Assigned to Redressal Committee • SLA Monitored'}
              </p>
            </div>
          </div>
          <Link to="/ledger" className="px-3.5 py-1.5 bg-[#FAF5EE] hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-semibold text-[#6B1724] transition flex items-center gap-1.5 shadow-sm">
            <i className="fa-solid fa-fingerprint"></i> SHA-256 Ledger
          </Link>
        </header>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Top Row: Complaint Details & SLA Timer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h2 className="font-bold text-stone-800 text-sm">
                  {complaintData?.title ? complaintData.title : 'Complaint Details'}
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold"><i className="fa-solid fa-shield"></i> Merkle Verified</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-stone-400 block text-[10px]">Category:</span>
                  <span className="font-bold text-stone-800">{complaintData?.category || 'Harassment & Safety'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Filed On:</span>
                  <span className="font-bold text-stone-800">
                    {complaintData?.createdAt ? new Date(complaintData.createdAt).toLocaleDateString() : '12 Oct 2026, 10:30 AM'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Status:</span>
                  <span className="font-bold text-emerald-700">{complaintData?.status || 'Filed'}</span>
                </div>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] mb-1">Description:</span>
                <p className="bg-[#FAF5EE] p-3.5 rounded-xl border border-stone-200 text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {complaintData?.description || 'Enter the description of the problem here.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-stone-400 text-[10px]">Attachments:</span>
                {complaintData?.attachments && complaintData.attachments.length > 0 ? (
                  complaintData.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-[11px] font-mono border border-stone-200 flex items-center gap-1 transition text-stone-800"
                    >
                      <i className="fa-solid fa-paperclip text-[#6B1724]"></i>
                      <span>{att.originalName || `Attachment-${idx+1}`}</span>
                    </a>
                  ))
                ) : (
                  <span className="text-stone-400 italic text-[11px]">No external attachments</span>
                )}
              </div>
            </div>

            {/* SLA Timer */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between text-center">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">SLA Escalation Timer</span>
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">Live Enforced</span>
                </div>
                <div className="w-24 h-24 mx-auto my-2 rounded-full border-4 border-rose-100 border-t-rose-600 flex flex-col items-center justify-center bg-rose-50/20">
                  <span className="font-mono font-extrabold text-base text-rose-600">{formatSla(slaSeconds)}</span>
                  <span className="text-[8px] text-rose-400 uppercase">remaining</span>
                </div>
              </div>
              <div className="text-xs bg-[#FAF5EE] p-3 rounded-xl border border-stone-200">
                <span className="text-stone-400 block text-[10px]">Current Stage:</span>
                <p className="font-bold text-amber-700">In Review (Under investigation by ICC)</p>
              </div>
            </div>
          </div>

          {/* Bottom Row: State Machine & Inquiry Chat */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* State Machine Timeline */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
              <h3 className="font-bold text-stone-800 text-xs uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-2.5">Status Timeline (State Machine)</h3>
              <div className="relative pl-5 space-y-5 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 text-xs">
                <div className="relative">
                  <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]"><i className="fa-solid fa-check"></i></span>
                  <p className="font-bold text-stone-800">Filed</p>
                  <p className="text-[10px] text-stone-400 font-mono">12 Oct 2026, 10:30 AM • By Student</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]"><i className="fa-solid fa-check"></i></span>
                  <p className="font-bold text-stone-800">Assigned</p>
                  <p className="text-[10px] text-stone-400 font-mono">12 Oct 2026, 02:15 PM • Assigned to ICC Officer</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[7px] animate-spin"><i className="fa-solid fa-rotate"></i></span>
                  <p className="font-bold text-amber-700">In Review (Current)</p>
                  <p className="text-[10px] text-stone-400 font-mono">13 Oct 2026, 09:00 AM • Under Formal Inquiry</p>
                </div>
                <div className="relative opacity-40">
                  <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-stone-300"></span>
                  <p className="font-bold text-stone-500">Resolved</p>
                  <p className="text-[10px] text-stone-400">Pending Committee Findings</p>
                </div>
                <div className="relative opacity-40">
                  <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-stone-300"></span>
                  <p className="font-bold text-stone-500">Escalated</p>
                  <p className="text-[10px] text-stone-400">Ombudsman Escalation If SLA Breached</p>
                </div>
              </div>
            </div>

            {/* Inquiry Chat */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between overflow-hidden">
              <div className="p-3.5 border-b border-stone-100 bg-[#FAF5EE] flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-stone-800">Inquiry Chat - #NY-1048</span>
                </div>
                <span className="text-[10px] text-[#6B1724] bg-rose-100/70 px-2.5 py-0.5 rounded-md font-mono font-bold">Secure Official Channel</span>
              </div>

              {/* Chat Stream */}
              <div ref={chatStreamRef} className="p-4 space-y-3.5 overflow-y-auto max-h-80 text-xs">
                {messages.map((msg, idx) => (
                  msg.from === 'icc' ? (
                    <div key={idx} className="flex items-start gap-2.5 max-w-sm">
                      <div className="w-7 h-7 rounded-full bg-[#6B1724] text-white flex items-center justify-center text-[10px] font-bold shrink-0">ICC</div>
                      <div>
                        <div className="bg-stone-100 p-3 rounded-2xl rounded-tl-sm text-stone-800 leading-relaxed shadow-sm border border-stone-200">
                          {msg.name && <p className="text-[10px] font-bold text-[#6B1724] mb-0.5">{msg.name}</p>}
                          {msg.isHash ? (
                            <p>Attachment received and hashed: <span className="font-mono text-[9px] bg-white px-1 py-0.5 rounded border">{msg.fileName}</span>.</p>
                          ) : msg.text}
                        </div>
                        <span className="text-[9px] text-stone-400 mt-1 block font-mono">{msg.time}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="flex items-start gap-2.5 max-w-sm ml-auto flex-row-reverse">
                      <div className="w-7 h-7 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">You</div>
                      <div className="text-right">
                        <div className="bg-[#6B1724] text-white p-3 rounded-2xl rounded-tr-sm text-left leading-relaxed shadow-sm">
                          {msg.text}
                          {msg.attachment && (
                            <div className="mt-2 p-1.5 bg-black/20 rounded flex items-center gap-2 text-[10px]">
                              <i className={`fa-solid ${msg.attachment.icon} text-[#E8C582]`}></i>
                              <span className="font-mono">{msg.attachment.name}</span>
                              <span className="text-[9px] text-rose-200 ml-auto">{msg.attachment.size}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-stone-400 mt-1 block font-mono">{msg.time}</span>
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* Quick Prompt Suggestion Chips */}
              <div className="px-3.5 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-2 overflow-x-auto text-[11px]">
                <button type="button" onClick={() => sendQuickPrompt('I have shared all relevant CCTV timestamps.')} className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-600 whitespace-nowrap transition">📍 Shared CCTV info</button>
                <button type="button" onClick={() => sendQuickPrompt('Could you please update me on the committee resolution timeline?')} className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-600 whitespace-nowrap transition">⏱️ Status update inquiry</button>
                <button type="button" onClick={() => sendQuickPrompt('Thank you. Awaiting the committee decision.')} className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-600 whitespace-nowrap transition">🙏 Thank you</button>
              </div>

              {/* Interactive Input Form */}
              <form onSubmit={handleChatSubmit} className="p-3 border-t border-stone-100 flex items-center gap-2 bg-[#FAF5EE]/70">
                <input type="file" id="chatAttachInput" onChange={attachFileToChat} className="hidden" />
                <button type="button" onClick={() => document.getElementById('chatAttachInput').click()} title="Attach file or screenshot" className="p-2 text-stone-500 hover:text-[#6B1724] transition rounded-lg hover:bg-stone-100">
                  <i className="fa-solid fa-paperclip text-sm"></i>
                </button>
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} required placeholder="Type your response to ICC authority... (Press Enter to send)" className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#6B1724] bg-white" />
                <button type="submit" className="px-4 py-2 bg-[#6B1724] hover:bg-[#54121C] text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5">
                  <span>Send</span> <i className="fa-solid fa-paper-plane text-[10px]"></i>
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PetitionDetails;