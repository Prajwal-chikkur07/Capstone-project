import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mail, Slack, Linkedin, MessageSquare, Check, Eye, EyeOff,
  Volume2, ChevronDown, Mic2, RefreshCw, ChevronRight, ArrowLeft,
  Pencil, Globe, Bell, Shield, LogOut, Sparkles, X, Save,
} from 'lucide-react';

/* ─── helpers ─── */
const LANG_LABELS = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};
const LANG_PREFIXES = {
  'hi-IN': ['hi'], 'bn-IN': ['bn'], 'ta-IN': ['ta'], 'te-IN': ['te'],
  'ml-IN': ['ml'], 'mr-IN': ['mr'], 'gu-IN': ['gu'], 'kn-IN': ['kn'],
  'pa-IN': ['pa'], 'or-IN': ['or'],
};
const CHANNEL_META = [
  { id: 'email',    label: 'Email',    icon: Mail,          color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-100',   credKey: 'email' },
  { id: 'slack',    label: 'Slack',    icon: Slack,         color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100', credKey: 'slackWebhook' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin,      color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-100',    credKey: 'linkedinToken' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100',  credKey: 'whatsappPhone' },
];
const CHANNEL_SECTIONS = [
  {
    id: 'email', icon: Mail, label: 'Email', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100',
    desc: 'Send transcripts via email app (mailto)',
    fields: [
      { key: 'email',        label: 'Your email address', placeholder: 'you@example.com', type: 'email' },
      { key: 'emailSubject', label: 'Default subject',    placeholder: 'Message from SeedlingSpeaks', type: 'text' },
    ],
  },
  {
    id: 'slack', icon: Slack, label: 'Slack', color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100',
    desc: 'Post to a Slack channel via incoming webhook',
    fields: [{ key: 'slackWebhook', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...', type: 'text', secret: true }],
  },
  {
    id: 'linkedin', icon: Linkedin, label: 'LinkedIn', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100',
    desc: 'Share posts to LinkedIn',
    fields: [{ key: 'linkedinToken', label: 'Access token (optional)', placeholder: 'LinkedIn OAuth token', type: 'text', secret: true }],
  },
  {
    id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp', color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100',
    desc: 'Open WhatsApp Web with message pre-filled',
    fields: [{ key: 'whatsappPhone', label: 'Phone number', placeholder: '919876543210 (with country code)', type: 'tel' }],
  },
];

function loadProfile() {
  try { return JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch { return {}; }
}

function SecretInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all bg-white" />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PageHeader({ title, subtitle, onBack }) {
  return (
    <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      <div>
        <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─── Voice sub-view ─── */
function VoiceView({ onBack }) {
  const { state, setField } = useApp();
  const [allVoices, setAllVoices] = useState([]);
  const [previewLang, setPreviewLang] = useState(state.selectedLanguage);

  const refreshVoices = () => setAllVoices(window.speechSynthesis?.getVoices() || []);
  useEffect(() => {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const prefixes = LANG_PREFIXES[previewLang] || [previewLang.split('-')[0]];
  const filtered = allVoices.filter(v => prefixes.some(p => v.lang === p || v.lang.startsWith(p + '-')));
  const displayVoices = filtered.length > 0 ? filtered : allVoices.slice(0, 12);
  const activeVoice = allVoices.find(v => v.voiceURI === state.selectedVoice);

  const handlePreview = (voice) => {
    window.speechSynthesis.cancel();
    const samples = {
      'hi-IN': 'नमस्ते, यह एक परीक्षण है।', 'ta-IN': 'வணக்கம், இது ஒரு சோதனை.',
      'te-IN': 'నమస్కారం, ఇది ఒక పరీక్ష.', 'bn-IN': 'হ্যালো, এটি একটি পরীক্ষা।',
      'ml-IN': 'ഹലോ, ഇത് ഒരു പരീക്ഷണമാണ്.', 'mr-IN': 'नमस्कार, हे एक चाचणी आहे.',
      'gu-IN': 'નમસ્તે, આ એક પરીક્ષણ છે.', 'kn-IN': 'ನಮಸ್ಕಾರ, ಇದು ಒಂದು ಪರೀಕ್ಷೆ.',
    };
    const utter = new SpeechSynthesisUtterance(samples[previewLang] || 'Hello, this is a voice preview.');
    utter.voice = voice; utter.lang = voice.lang; utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <PageHeader title="Voice" subtitle="Text-to-speech preferences" onBack={onBack} />
      <div className="px-8 py-8 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                <Volume2 className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Text-to-Speech Voice</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Click any voice to select · speaker icon to preview</p>
              </div>
            </div>
            <button onClick={refreshVoices} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[13px] text-gray-500 font-medium shrink-0">Filter by language</span>
            <div className="relative flex-1">
              <select value={previewLang} onChange={e => setPreviewLang(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-[13px] font-medium text-gray-700 cursor-pointer focus:outline-none hover:border-gray-300 transition-all">
                {Object.entries(LANG_LABELS).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {displayVoices.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-[14px]">No voices found. Click refresh.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {displayVoices.map((voice) => {
                const sel = state.selectedVoice === voice.voiceURI;
                return (
                  <div key={voice.voiceURI} onClick={() => setField('selectedVoice', voice.voiceURI)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${sel ? 'bg-gray-900 border-gray-900' : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${sel ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{voice.name[0]}</div>
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${sel ? 'text-white' : 'text-gray-800'}`}>{voice.name}</p>
                        <p className={`text-[11px] ${sel ? 'text-white/60' : 'text-gray-400'}`}>{voice.lang} {voice.localService ? '· Local' : '· Network'}</p>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handlePreview(voice); }}
                      className={`shrink-0 p-1.5 rounded-lg transition-all ${sel ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`}>
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <Mic2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[13px] text-gray-500">Active: <span className="font-semibold text-gray-800">{activeVoice ? activeVoice.name : 'Auto (best match)'}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Channels sub-view ─── */
function ChannelsView({ onBack }) {
  const { state, saveCredentials, showSuccess } = useApp();
  const [form, setForm] = useState({ ...state.channelCredentials });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveCredentials(form);
    setSaved(true);
    showSuccess('Credentials saved');
    setTimeout(() => setSaved(false), 2500);
  };

  const isConnected = (s) => s.fields.some(f => form[f.key]?.trim());

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <PageHeader title="Connect channels" subtitle="Set once, send anytime" onBack={onBack} />
      <div className="px-8 py-8 max-w-2xl space-y-4">
        {CHANNEL_SECTIONS.map((section) => (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl ${section.bg} ${section.border} border flex items-center justify-center shrink-0`}>
                <section.icon className={`w-4 h-4 ${section.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-gray-900">{section.label}</p>
                  {isConnected(section) && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Connected
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-gray-400 mt-0.5">{section.desc}</p>
              </div>
            </div>
            <div className="space-y-3">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">{field.label}</label>
                  {field.secret ? (
                    <SecretInput value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder} />
                  ) : (
                    <input type={field.type} value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all bg-white" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={handleSave}
          className={`w-full py-3 rounded-2xl text-[14px] font-semibold transition-all active:scale-[0.99] ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
          {saved ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" />Saved</span> : 'Save credentials'}
        </button>
      </div>
    </div>
  );
}

/* ─── Edit Profile modal ─── */
function EditProfileModal({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile.name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [role, setRole] = useState(profile.role || '');

  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleSave = () => {
    onSave({ name: name.trim(), email: email.trim(), role: role.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-bold text-gray-900">Edit profile</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-extrabold text-[20px]">{initials}</div>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Full name', value: name, set: setName, placeholder: 'Your name', type: 'text' },
            { label: 'Email', value: email, set: setEmail, placeholder: 'you@example.com', type: 'email' },
            { label: 'Role / title', value: role, set: setRole, placeholder: 'e.g. Product Manager', type: 'text' },
          ].map(({ label, value, set, placeholder, type }) => (
            <div key={label}>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">{label}</label>
              <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-gray-400 transition-all" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 transition-all">
            <Save className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Profile page ─── */
export default function Profile() {
  const { state, setField } = useApp();
  const [subView, setSubView] = useState(null);
  const [profile, setProfile] = useState(() => loadProfile());
  const [editOpen, setEditOpen] = useState(false);

  const saveProfile = (updated) => {
    setProfile(updated);
    localStorage.setItem('userProfile', JSON.stringify(updated));
  };

  if (subView === 'voice')    return <VoiceView    onBack={() => setSubView(null)} />;
  if (subView === 'channels') return <ChannelsView onBack={() => setSubView(null)} />;

  const initials = (profile.name || 'U').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const creds = state.channelCredentials || {};
  const connectedChannels = CHANNEL_META.filter(ch => creds[ch.credKey]?.trim());

  const navItems = [
    { key: 'voice',    icon: Volume2,      label: 'Voice & TTS',        desc: 'Text-to-speech voice preferences' },
    { key: 'channels', icon: Mail,         label: 'Connected channels', desc: 'Email, Slack, LinkedIn, WhatsApp' },
  ];

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <PageHeader title="Profile" subtitle="Your account and preferences" />

      <div className="px-8 py-8 max-w-2xl space-y-4">

        {/* ── Avatar card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-extrabold text-[20px] shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-extrabold text-gray-900 truncate">{profile.name || 'Your Name'}</p>
              <p className="text-[13px] text-gray-400 mt-0.5 truncate">{profile.email || 'Add your email'}</p>
              {profile.role && <p className="text-[12px] text-gray-300 mt-0.5 truncate">{profile.role}</p>}
            </div>
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all shrink-0">
              <Pencil className="w-3.5 h-3.5" />Edit
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-3">
            {[
              { label: 'Transcripts', value: state.transcriptHistory?.length || 0 },
              { label: 'Templates',   value: state.savedTemplates?.length || 0 },
              { label: 'Channels',    value: connectedChannels.length },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[20px] font-extrabold text-gray-900">{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Default language ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Default language</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Used for translation output</p>
              </div>
            </div>
            <div className="relative">
              <select value={state.selectedLanguage} onChange={e => setField('selectedLanguage', e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-[13px] font-semibold text-gray-700 cursor-pointer focus:outline-none hover:border-gray-300 transition-all">
                {Object.entries(LANG_LABELS).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Connected channels status ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-semibold text-gray-900">Connected channels</p>
            <button onClick={() => setSubView('channels')}
              className="text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors">Manage →</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CHANNEL_META.map((ch) => {
              const connected = !!creds[ch.credKey]?.trim();
              return (
                <div key={ch.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${connected ? `${ch.bg} ${ch.border}` : 'bg-gray-50 border-gray-100'}`}>
                  <ch.icon className={`w-4 h-4 shrink-0 ${connected ? ch.color : 'text-gray-300'}`} />
                  <span className={`text-[13px] font-semibold ${connected ? 'text-gray-800' : 'text-gray-300'}`}>{ch.label}</span>
                  {connected
                    ? <Check className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                    : <span className="text-[11px] text-gray-300 ml-auto">Not set</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Settings nav items ── */}
        <div className="space-y-2">
          {navItems.map(({ key, icon: Icon, label, desc }) => (
            <button key={key} onClick={() => setSubView(key)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between hover:border-gray-300 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-semibold text-gray-900">{label}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          ))}
        </div>

        {/* ── App info ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">SeedlingSpeaks v2.5</p>
              <p className="text-[12px] text-gray-400 mt-0.5">Powered by Seedlinglabs</p>
            </div>
          </div>
          <div className="space-y-1 text-[12px] text-gray-400 pl-12">
            <p>Transcription · Sarvam AI</p>
            <p>Tone rewriting · Gemini 2.0 Flash</p>
            <p>Translation cache · Semantic RAG (MiniLM)</p>
          </div>
        </div>

        {/* ── Danger zone ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[12px] font-bold text-gray-300 uppercase tracking-widest mb-3">Account</p>
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-800 transition-all text-left group">
              <Shield className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              <span className="text-[13px] font-medium">Privacy &amp; data</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-800 transition-all text-left group">
              <Bell className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              <span className="text-[13px] font-medium">Notifications</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all text-left">
              <LogOut className="w-4 h-4" />
              <span className="text-[13px] font-medium">Sign out</span>
            </button>
          </div>
        </div>

      </div>

      {editOpen && <EditProfileModal profile={profile} onSave={saveProfile} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
