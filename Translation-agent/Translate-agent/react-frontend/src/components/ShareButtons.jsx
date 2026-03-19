import { Mail, MessageSquare, Linkedin, X, MessageCircle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

const inputCls = "w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-xl px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all font-[inherit]";

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-[#e8e8ed] shadow-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#aeaeb2] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ShareButtons() {
  const { state, setLoading, showError, showSuccess } = useApp();
  const [emailModal, setEmailModal] = useState(false);
  const [slackModal, setSlackModal] = useState(false);
  const [linkedinModal, setLinkedinModal] = useState(false);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Translated Message');
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(state.rewrittenText)}`, '_blank');
    showSuccess('WhatsApp opened!');
  }, [state.rewrittenText, showSuccess]);

  const handleEmail = useCallback(async () => {
    if (!email) return;
    setEmailModal(false);
    try {
      setLoading('Sending email...');
      await api.sendEmail({ text: state.rewrittenText, toEmail: email, subject, tone: state.selectedTone, language: 'en' });
      setLoading(null);
      showSuccess('Email sent!');
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'Email error');
    }
    setEmail(''); setSubject('Translated Message');
  }, [email, subject, state.rewrittenText, state.selectedTone, setLoading, showError, showSuccess]);

  const handleSlack = useCallback(async () => {
    setSlackModal(false);
    try {
      setLoading('Sending to Slack...');
      await api.sendToSlack({ text: state.rewrittenText, webhookUrl: webhookUrl || null, tone: state.selectedTone, language: 'en' });
      setLoading(null);
      showSuccess('Sent to Slack!');
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'Slack error');
    }
    setWebhookUrl('');
  }, [webhookUrl, state.rewrittenText, state.selectedTone, setLoading, showError, showSuccess]);

  const handleLinkedIn = useCallback(async () => {
    setLinkedinModal(false);
    try {
      setLoading('Sharing to LinkedIn...');
      const res = await api.shareToLinkedIn({ text: state.rewrittenText, tone: state.selectedTone, language: 'en' });
      setLoading(null);
      showSuccess(res.message || 'Shared to LinkedIn!');
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'LinkedIn error');
    }
  }, [state.rewrittenText, state.selectedTone, setLoading, showError, showSuccess]);

  if (!state.rewrittenText) return null;

  const shareOptions = [
    { icon: MessageCircle, label: 'WhatsApp', onClick: handleWhatsApp,             cls: 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100' },
    { icon: Mail,          label: 'Email',    onClick: () => setEmailModal(true),   cls: 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100' },
    { icon: MessageSquare, label: 'Slack',    onClick: () => setSlackModal(true),   cls: 'text-violet-700 bg-violet-50 border-violet-100 hover:bg-violet-100' },
    { icon: Linkedin,      label: 'LinkedIn', onClick: () => setLinkedinModal(true),cls: 'text-sky-700 bg-sky-50 border-sky-100 hover:bg-sky-100' },
  ];

  return (
    <>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Share</p>
        <div className="flex flex-wrap gap-2">
            {shareOptions.map(({ icon: Icon, label, onClick, cls }) => (
              <button key={label} onClick={onClick}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[12px] font-medium transition-all ${cls}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
      </div>

      {emailModal && (
        <Modal title="Send via Email" onClose={() => setEmailModal(false)}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recipient@email.com" className={inputCls} />
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputCls} />
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setEmailModal(false)} className="px-4 py-2 text-[12px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">Cancel</button>
            <button onClick={handleEmail} className="px-4 py-2 text-[12px] font-medium bg-[#1d1d1f] text-white rounded-full hover:bg-[#3a3a3c] transition-colors">Send</button>
          </div>
        </Modal>
      )}

      {slackModal && (
        <Modal title="Send to Slack" onClose={() => setSlackModal(false)}>
          <p className="text-[12px] text-[#6e6e73]">Enter your Slack Webhook URL or configure it in the backend .env file.</p>
          <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/... (optional)" className={inputCls} />
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setSlackModal(false)} className="px-4 py-2 text-[12px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">Cancel</button>
            <button onClick={handleSlack} className="px-4 py-2 text-[12px] font-medium bg-[#1d1d1f] text-white rounded-full hover:bg-[#3a3a3c] transition-colors">Send</button>
          </div>
        </Modal>
      )}

      {linkedinModal && (
        <Modal title="Share to LinkedIn" onClose={() => setLinkedinModal(false)}>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[12px] text-amber-700">LinkedIn OAuth not configured — uses mock mode.</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e8e8ed]">
            <p className="text-[10px] text-[#aeaeb2] mb-1.5 font-semibold uppercase tracking-wide">Preview</p>
            <p className="text-[13px] text-[#3a3a3c] line-clamp-3">{state.rewrittenText}</p>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setLinkedinModal(false)} className="px-4 py-2 text-[12px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">Cancel</button>
            <button onClick={handleLinkedIn} className="px-4 py-2 text-[12px] font-medium bg-[#1d1d1f] text-white rounded-full hover:bg-[#3a3a3c] transition-colors">Share</button>
          </div>
        </Modal>
      )}
    </>
  );
}
