import { Mail, MessageSquare, Linkedin, X, MessageCircle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/50">
            <X className="w-5 h-5" />
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
    const text = encodeURIComponent(state.rewrittenText);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    showSuccess('WhatsApp opened!');
  }, [state.rewrittenText, showSuccess]);

  const handleEmail = useCallback(async () => {
    if (!email) return;
    setEmailModal(false);
    try {
      setLoading('Sending email...');
      await api.sendEmail({
        text: state.rewrittenText,
        toEmail: email,
        subject,
        tone: state.selectedTone,
        language: 'en',
      });
      setLoading(null);
      showSuccess('Email sent successfully!');
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'Email error');
    }
    setEmail('');
    setSubject('Translated Message');
  }, [email, subject, state.rewrittenText, state.selectedTone, setLoading, showError, showSuccess]);

  const handleSlack = useCallback(async () => {
    setSlackModal(false);
    try {
      setLoading('Sending to Slack...');
      await api.sendToSlack({
        text: state.rewrittenText,
        webhookUrl: webhookUrl || null,
        tone: state.selectedTone,
        language: 'en',
      });
      setLoading(null);
      showSuccess('Sent to Slack successfully!');
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
      const res = await api.shareToLinkedIn({
        text: state.rewrittenText,
        tone: state.selectedTone,
        language: 'en',
      });
      setLoading(null);
      showSuccess(res.message || 'Shared to LinkedIn!');
    } catch (err) {
      setLoading(null);
      showError(err.response?.data?.detail || 'LinkedIn error');
    }
  }, [state.rewrittenText, state.selectedTone, setLoading, showError, showSuccess]);

  if (!state.rewrittenText) return null;

  const shareOptions = [
    { icon: MessageCircle, label: 'WhatsApp', color: 'green', onClick: handleWhatsApp },
    { icon: Mail, label: 'Email', color: 'red', onClick: () => setEmailModal(true) },
    { icon: MessageSquare, label: 'Slack', color: 'purple', onClick: () => setSlackModal(true) },
    { icon: Linkedin, label: 'LinkedIn', color: 'blue', onClick: () => setLinkedinModal(true) },
  ];

  const colorMap = {
    green: 'bg-green-50 border-green-100 text-green-600 hover:bg-green-100',
    red: 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100',
    purple: 'bg-purple-50 border-purple-100 text-purple-600 hover:bg-purple-100',
    blue: 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100',
  };

  return (
    <>
      <div className="glass-card">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Share to English Channels</p>
        <div className="flex flex-wrap gap-3">
          {shareOptions.map(({ icon: Icon, label, color, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${colorMap[color]}`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-bold text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <Modal title="Send via Email" onClose={() => setEmailModal(false)}>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@email.com"
              className="input-field text-sm"
            />
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="input-field text-sm"
            />
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setEmailModal(false)} className="btn-secondary px-4 py-1.5 text-xs">Cancel</button>
              <button onClick={handleEmail} className="btn-primary px-4 py-1.5 text-xs">Send Email</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Slack Modal */}
      {slackModal && (
        <Modal title="Send to Slack" onClose={() => setSlackModal(false)}>
          <p className="text-xs text-white/40">
            Enter your Slack Webhook URL or configure it in the backend .env file.
          </p>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/... (optional)"
            className="input-field"
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setSlackModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
            <button onClick={handleSlack} className="btn-primary px-4 py-2">Send</button>
          </div>
        </Modal>
      )}

      {/* LinkedIn Modal */}
      {linkedinModal && (
        <Modal title="Share to LinkedIn" onClose={() => setLinkedinModal(false)}>
          <p className="text-sm text-white/70">This will share your styled text to LinkedIn.</p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400">
              Note: LinkedIn OAuth is not configured. This will use mock mode for demonstration.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <p className="text-xs text-white/40 mb-1 font-medium">Preview:</p>
            <p className="text-sm text-white/70">
              {state.rewrittenText.length > 100
                ? state.rewrittenText.substring(0, 100) + '...'
                : state.rewrittenText}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setLinkedinModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
            <button onClick={handleLinkedIn} className="btn-primary px-4 py-2">Share</button>
          </div>
        </Modal>
      )}
    </>
  );
}
