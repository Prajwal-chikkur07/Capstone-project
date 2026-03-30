import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Download, Trash2, Play, ArrowLeft, Clock } from 'lucide-react';

const HISTORY_KEY = 'vt_video_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {} }

const LANG_NAMES = {
  'hi-IN': 'Hindi', 'en-IN': 'English', 'kn-IN': 'Kannada',
  'ta-IN': 'Tamil', 'te-IN': 'Telugu', 'ml-IN': 'Malayalam',
  'bn-IN': 'Bengali', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati', 'pa-IN': 'Punjabi',
};

export default function VideoHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState(loadHistory);
  const [playing, setPlaying] = useState(null);

  const deleteItem = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    if (playing === id) setPlaying(null);
  };

  const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 md:py-4 flex items-center gap-3">
        <button onClick={() => navigate('/app/video')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-[18px] md:text-[20px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Video History
          </h2>
          <p className="text-[12px] text-gray-400 mt-0.5">{history.length} translated video{history.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <Film className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-[15px] font-semibold text-gray-400">No translated videos yet</p>
            <p className="text-[13px] text-gray-400">Translate a video and it will appear here</p>
            <button onClick={() => navigate('/app/video')}
              className="mt-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-semibold hover:bg-gray-700 transition-all">
              Translate a video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
                {/* Video player */}
                <div className="bg-black relative">
                  {playing === item.id ? (
                    <video
                      src={`/api/video/download/${item.videoId}`}
                      controls
                      autoPlay
                      className="w-full object-contain"
                      style={{ maxHeight: '220px' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center cursor-pointer"
                      style={{ height: '180px' }}
                      onClick={() => setPlaying(item.id)}
                    >
                      <div className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">
                        {item.filename || `Video · ${LANG_NAMES[item.targetLang] || item.targetLang}`}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded-md font-medium text-gray-600">
                          {LANG_NAMES[item.targetLang] || item.targetLang}
                        </span>
                        · {fmt(item.timestamp)}
                      </p>
                    </div>
                    <button onClick={() => deleteItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.translated_text && (
                    <p className="text-[12px] text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                      {item.translated_text}
                    </p>
                  )}

                  <a
                    href={`/api/video/download/${item.videoId}`}
                    download={`translated_${item.videoId}.mp4`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 bg-gray-900 text-white rounded-xl text-[12px] font-semibold hover:bg-gray-700 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
