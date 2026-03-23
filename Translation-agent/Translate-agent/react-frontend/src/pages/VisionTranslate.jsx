import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Upload, Loader2, ChevronDown, Languages, ImageIcon, RefreshCw, Copy, Check, Download
} from 'lucide-react';
import * as api from '../services/api';
import { getLabels } from '../services/uiLabels';

const LANG_LABELS = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

export default function VisionTranslate() {
  const { state } = useApp();
  const L = getLabels(state.uiLanguage);
  const [targetLang, setTargetLang] = useState(state.selectedLanguage || 'hi-IN');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [regions, setRegions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Track rendered image size for overlay positioning
  useEffect(() => {
    if (!imageUrl) return;
    const update = () => {
      if (imgRef.current) {
        setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
      }
    };
    const obs = new ResizeObserver(update);
    if (imgRef.current) obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [imageUrl, regions]);

  const loadImage = (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) { setError('Only PNG, JPG, and WEBP images are supported.'); return; }
    setImageFile(file);
    setRegions([]);
    setError('');
    setShowOriginal(false);
    setImageUrl(URL.createObjectURL(file));
  };

  const handleTranslate = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setError('');
    setRegions([]);
    setShowOriginal(false);
    try {
      const result = await api.visionTranslate(imageFile, targetLang);
      const r = result.regions || [];
      setRegions(r);
      if (!r.length) setError('No text detected in this image.');
    } catch (e) {
      const raw = e.response?.data?.detail || e.message || '';
      if (raw.includes('quota') || raw.includes('429') || raw.includes('rate')) {
        setError('Gemini API quota exceeded. Please wait a moment and try again.');
      } else if (raw.includes('API key') || raw.includes('401') || raw.includes('403')) {
        setError('Invalid or missing Gemini API key. Check your .env configuration.');
      } else {
        setError('Translation failed. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setImageUrl(null);
    setRegions([]);
    setError('');
    setShowOriginal(false);
  };

  const copyAll = () => {
    const text = regions.map(r => r.translated).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadText = () => {
    const text = regions.map((r, i) =>
      `[${i + 1}] Original: ${r.original}\n    ${LANG_LABELS[targetLang]}: ${r.translated}`
    ).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `translated_${imageFile?.name?.replace(/\.[^.]+$/, '') || 'image'}.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gray-400" />
            {L.visionTranslateTitle}
          </h2>
          <p className="text-[13px] text-gray-400 mt-0.5">
            Upload an image — translated text appears directly on the image
          </p>
        </div>
        <div className="relative">
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-[13px] font-semibold text-gray-700 cursor-pointer focus:outline-none hover:border-gray-300 transition-all shadow-sm"
          >
            {Object.entries(LANG_LABELS).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto">
        {/* Upload zone */}
        {!imageUrl && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); loadImage(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-24 ${
              dragging ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={e => loadImage(e.target.files[0])} />
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Upload className="w-7 h-7 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold text-gray-700">{L.dropImageHere}</p>
              <p className="text-[13px] text-gray-400 mt-1">PNG, JPG, WEBP · up to 10MB</p>
            </div>
          </div>
        )}

        {/* Image loaded */}
        {imageUrl && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleTranslate}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all active:scale-95"
              >
                {isProcessing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Translating…</>
                  : <><Languages className="w-3.5 h-3.5" />{L.translate} to {LANG_LABELS[targetLang]}</>}
              </button>

              {regions.length > 0 && (
                <>
                  {/* Show original toggle — Google Translate style */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl">
                    <span className="text-[12px] font-medium text-gray-500">Show original</span>
                    <button
                      onClick={() => setShowOriginal(v => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${showOriginal ? 'bg-blue-500' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showOriginal ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>

                  <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-medium hover:bg-gray-50 transition-all">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {L.copyAll}
                  </button>
                  <button onClick={downloadText} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-medium hover:bg-gray-50 transition-all">
                    <Download className="w-3.5 h-3.5" />{L.download}
                  </button>
                  <span className="text-[12px] text-gray-400">{regions.length} text blocks</span>
                </>
              )}

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 text-[13px] font-medium transition-all ml-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />{L.newImage}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{error}</div>
            )}

            {/* Processing banner */}
            {isProcessing && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[13px] text-amber-700">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Gemini Vision is reading and translating all text in the image…
              </div>
            )}

            {/* Image with overlay */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div ref={containerRef} className="relative inline-block w-full flex justify-center bg-[#f0f0f0] p-4">
                <div className="relative inline-block">
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Uploaded"
                    onLoad={() => {
                      if (imgRef.current) setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
                    }}
                    style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block', borderRadius: 8 }}
                  />

                  {/* Translation overlays — Google Translate style */}
                  {!showOriginal && imgSize.w > 0 && regions.map((r, i) => {
                    const left = r.x * imgSize.w;
                    const top = r.y * imgSize.h;
                    const width = r.w * imgSize.w;
                    const height = r.h * imgSize.h;
                    const fontSize = Math.max(10, Math.min(r.font_size * imgSize.h, 28));
                    const bg = r.bg_color || '#ffffff';
                    const color = r.text_color || '#000000';

                    return (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left, top, width, height,
                          background: bg,
                          color,
                          fontSize,
                          fontWeight: 500,
                          lineHeight: 1.3,
                          padding: '2px 4px',
                          borderRadius: 3,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          boxSizing: 'border-box',
                          wordBreak: 'break-word',
                          hyphens: 'auto',
                        }}
                        title={`Original: ${r.original}`}
                      >
                        {r.translated}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
