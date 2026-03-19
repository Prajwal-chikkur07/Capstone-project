import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mail, Slack, Linkedin, MessageSquare, Check, Eye, EyeOff,
  Volume2, ChevronDown, Mic2, RefreshCw, Settings, ChevronRight, ArrowLeft
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'email', icon: Mail, label: 'Email',
    color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100',
    desc: 'Send transcripts via Gmail using an App Password',
    fields: [
      { key: 'email',         label: 'Your Gmail address', placeholder: 'you@gmail.com', type: 'email' },
      { key: 'emailPassword', label: 'Gmail App Password', placeholder: 'xxxx xxxx xxxx xxxx', type: 'text', secret: true,
        hint: 'Generate at myaccount.google.com/apppasswords (requires 2FA enabled)' },
      { key: 'emailSubject',  label: 'Default subject',    placeholder: 'Message from TransUI', type: 'text' },
    ],
  },
  {
    id: 'slack', icon: Slack, label: 'Slack',
    color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100',
    desc: 'Post messages to a Slack channel via webhook',
    fields: [
      { key: 'slackWebhook', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...', type: 'text', secret: true },
    ],
  },
  {
    id: 'linkedin', icon: Linkedin, label: 'LinkedIn',
    color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100',
    desc: 'Share posts to LinkedIn (mock mode by default)',
    fields: [
      { key: 'linkedinToken', label: 'Access token (optional)', placeholder: 'LinkedIn OAuth token', type: 'text', secret: true },
    ],
  },
  {
    id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp',
    color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100',
    desc: 'Open WhatsApp Web with message pre-filled',
    fields: [
      { key: 'whatsappPhone', label: 'Phone number', placeholder: '919876543210 (with country code)', type: 'tel' },
    ],
  },
];

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

function Header({ title, subtitle, onBack }) {
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

/* ── Voice sub-view ── */
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
  const filteredVoices = allVoices.filter(v =>
    prefixes.some(p => v.lang === p || v.lang.startsWith(p + '-') || v.lang.startsWith(p))
  );
  const displayVoices = filteredVoices.length > 0 ? filteredVoices : allVoices.slice(0, 12);
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
      <Header title="Voice" subtitle="Text-to-speech preferences" onBack={onBack} />
      <div className="px-8 py-8 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">Text-to-Speech Voice</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Real voices from your device — click any to preview</p>
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
            <div className="text-center py-8 text-gray-300 text-[14px]">No voices found. Click refresh or check browser settings.</div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {displayVoices.map((voice) => {
                const isSelected = state.selectedVoice === voice.voiceURI;
                return (
                  <div key={voice.voiceURI} onClick={() => setField('selectedVoice', voice.voiceURI)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'bg-gray-900 border-gray-900' : 'bg-gray-50 border-gray-100 hover:border-gray-300 hover:bg-white'
                    }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>{voice.name[0]}</div>
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>{voice.name}</p>
                        <p className={`text-[11px] ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>{voice.lang} {voice.localService ? '· Local' : '· Network'}</p>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handlePreview(voice); }}
                      className={`shrink-0 p-1.5 rounded-lg transition-all ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`}>
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <Mic2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[13px] text-gray-500">
              Active: <span className="font-semibold text-gray-800">{activeVoice ? activeVoice.name : 'Auto (best match for language)'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Channels sub-view ── */
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

  const isConnected = (section) => section.fields.some(f => form[f.key]?.trim());

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Header title="Connect your channels" subtitle="Set once, send anytime" onBack={onBack} />
      <div className="px-8 py-8 max-w-2xl space-y-4">
        {SECTIONS.map((section) => (
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
                  {field.hint && <p className="mt-1.5 text-[11px] text-gray-400">{field.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={handleSave}
          className={`w-full py-3 rounded-2xl text-[14px] font-semibold transition-all active:scale-[0.99] ${
            saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}>
          {saved ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" />Saved</span> : 'Save credentials'}
        </button>
      </div>
    </div>
  );
}

/* ── Settings landing — two cards ── */
function SettingsView({ onBack }) {
  const [subView, setSubView] = useState(null);

  if (subView === 'voice')    return <VoiceView    onBack={() => setSubView(null)} />;
  if (subView === 'channels') return <ChannelsView onBack={() => setSubView(null)} />;

  const options = [
    { key: 'voice',    icon: Volume2, label: 'Voice',                 desc: 'Choose your text-to-speech voice' },
    { key: 'channels', icon: Mail,    label: 'Connect your channels', desc: 'Email, Slack, LinkedIn, WhatsApp' },
  ];

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Header title="Settings" subtitle="Voice preferences and channel credentials" onBack={onBack} />
      <div className="px-8 py-8 max-w-2xl space-y-3">
        {options.map(({ key, icon: Icon, label, desc }) => (
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
    </div>
  );
}

/* ── Profile landing ── */
export default function Profile() {
  const [view, setView] = useState('profile');

  if (view === 'settings') return <SettingsView onBack={() => setView('profile')} />;

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Header title="Profile" subtitle="Your account and preferences" />
      <div className="px-8 py-8 max-w-2xl space-y-4">

        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-extrabold text-[18px] shrink-0">PC</div>
          <div>
            <p className="text-[16px] font-bold text-gray-900">Prajwal C</p>
            <p className="text-[13px] text-gray-400 mt-0.5">Pro Account</p>
          </div>
        </div>

        {/* Settings card */}
        <button onClick={() => setView('settings')}
          className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between hover:border-gray-300 hover:shadow-md transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
              <Settings className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-gray-900">Settings</p>
              <p className="text-[12px] text-gray-400 mt-0.5">Voice preferences and channel credentials</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </button>

      </div>
    </div>
  );
}
