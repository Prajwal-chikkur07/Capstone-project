import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Upload, Loader2, Download, X, ChevronDown,
  Languages, ImageIcon, RefreshCw, Copy, Check,
  FileText, ArrowRight
} from 'lucide-react';
import * as api from '../services/api';
import { getLabels } from '../services/uiLabels';

const LANG_LABELS = {
  'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'or-IN': 'Odia',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

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
  const [activeIdx, setActiveIdx] = useState(null);
  const inputRef = useRef(null);
  const regionRefs = useRef([]);

  const loadImage = (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Only PNG, JPG, and WEBP images are supported.');
      return;
    }
    setImageFile(file);
    setRegions([]);
    setError('');
    setActiveIdx(null);
    setImageUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    loadImage(e.dataTransfer.files[0]);
  };

  const handleTranslate = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setError('');
    setRegions([]);
    setActiveIdx(null);
    try {
      const result = await api.visionTranslate(imageFile, targetLang);
      const r = result.regions || [];
      setRegions(r);
      if (!r.length) setError('No text detected in this image.');
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Translation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setImageUrl(null);
    setRegions([]);
    setError('');
    setActiveIdx(null);
  };

  const scrollToRegion = (i) => {
    setActiveIdx(i);
    regionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Copy all translated text
  const copyAll = () => {
    const text = regions.map((r, i) => `[${i + 1}] ${r.translated}`).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  // Download as text file
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
            Upload an image or PDF screenshot — Gemini reads all text and translates it
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

      <div className="px-8 py-6 max-w-7xl mx-auto">
        {/* Upload zone — shown when no image */}
        {!imageUrl && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-24 ${
              dragging ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={e => loadImage(e.target.files[0])}
            />
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Upload className="w-7 h-7 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold text-gray-700">{L.dropImageHere}</p>
              <p className="text-[13px] text-gray-400 mt-1">PNG, JPG, WEBP · up to 10MB</p>
              <p className="text-[12px] text-gray-300 mt-2">
                Works with photos of documents, signs, menus, PDF screenshots, receipts
              </p>
            </div>
          </div>
        )}

        {/* Main content after image loaded */}
        {imageUrl && (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleTranslate}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all active:scale-95"
              >
                {isProcessing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{L.translating}</>
                  : <><Languages className="w-3.5 h-3.5" />{L.translate} to {LANG_LABELS[targetLang]}</>}
              </button>

              {regions.length > 0 && (
                <>
                  <button
                    onClick={copyAll}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-medium hover:bg-gray-50 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />{L.copyAll}
                  </button>
                  <button
                    onClick={downloadText}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-medium hover:bg-gray-50 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />{L.download}
                  </button>
                  <span className="text-[12px] text-gray-400 ml-1">{regions.length} text blocks found</span>
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
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
                <X className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            {/* Processing */}
            {isProcessing && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[13px] text-amber-700">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Gemini Vision is reading and translating all text in the image…
              </div>
            )}

            {/* Side-by-side layout */}
            <div className="grid grid-cols-2 gap-4" style={{ minHeight: 480 }}>
              {/* Left: original image */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">{L.original}</span>
                  {imageFile && (
                    <span className="ml-auto text-[11px] text-gray-300 truncate max-w-[140px]">{imageFile.name}</span>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-3 flex items-start justify-center bg-gray-50">
                  <img
                    src={imageUrl}
                    alt="Uploaded"
                    style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Right: translated text */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[12px] font-bold text-blue-400 uppercase tracking-widest">
                    {LANG_LABELS[targetLang]} Translation
                  </span>
                  {regions.length > 0 && (
                    <span className="ml-auto text-[11px] text-gray-300">{regions.length} blocks</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto" style={{ maxHeight: '65vh' }}>
                  {/* Empty state */}
                  {!isProcessing && regions.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-16">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <ArrowRight className="w-5 h-5 text-gray-300" />
                      </div>
                      <p className="text-[14px] font-semibold text-gray-400">
                        Click "Translate to {LANG_LABELS[targetLang]}"
                      </p>
                      <p className="text-[12px] text-gray-300">
                        Gemini will read all text in the image and translate it
                      </p>
                    </div>
                  )}

                  {/* Translation blocks */}
                  {regions.length > 0 && (
                    <div className="divide-y divide-gray-50" ref={el => regionRefs.current = []}>
                      {regions.map((r, i) => (
                        <div
                          key={i}
                          ref={el => regionRefs.current[i] = el}
                          onClick={() => setActiveIdx(activeIdx === i ? null : i)}
                          className={`px-5 py-4 cursor-pointer transition-colors ${
                            activeIdx === i ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Block number + translated text */}
                          <div className="flex items-start gap-3">
                            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                              activeIdx === i ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] text-gray-900 font-medium leading-relaxed">
                                {r.translated}
                              </p>
                              {/* Show original on expand */}
                              {activeIdx === i && (
                                <p className="text-[12px] text-gray-400 mt-2 leading-relaxed border-t border-gray-100 pt-2">
                                  <span className="font-semibold text-gray-300 uppercase tracking-widest text-[10px]">Original: </span>
                                  {r.original}
                                </p>
                              )}
                            </div>
                            <CopyButton text={r.translated} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
