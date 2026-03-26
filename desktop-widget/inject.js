// This file is served by the widget's local HTTP server at http://127.0.0.1:27182/inject.js
// It is injected into the active Chrome tab via AppleScript.
// The action and lang are passed via window.__vtAction and window.__vtLang set before loading.

(async function () {
  const API = 'http://127.0.0.1:8000/api';
  const action = window.__vtAction;
  const lang = window.__vtLang || 'hi-IN';
  const srcLang = window.__vtSrcLang || 'en-IN';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function makeUndoBtn(originalText, span) {
    const btn = document.createElement('button');
    btn.textContent = '↩';
    btn.title = 'Restore original';
    btn.setAttribute('data-vt-undo', '1');
    btn.style.cssText = [
      'font-size:9px', 'margin-left:3px', 'vertical-align:middle',
      'background:rgba(99,102,241,0.15)', 'border:none', 'border-radius:3px',
      'cursor:pointer', 'color:#818cf8', 'padding:0 3px', 'line-height:1.4',
    ].join(';');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      span.replaceWith(document.createTextNode(originalText));
    });
    return btn;
  }

  function wrapTranslated(originalText, translatedText) {
    const span = document.createElement('span');
    span.className = 'vt-translated-inline';
    span.setAttribute('data-vt-original', originalText);
    span.style.cssText = 'background:rgba(99,102,241,0.07);border-radius:3px;padding:0 1px;';
    span.textContent = translatedText;
    span.appendChild(makeUndoBtn(originalText, span));
    return span;
  }

  async function translateText(text, src, tgt) {
    const res = await fetch(API + '/translate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_language: src, target_language: tgt }),
    });
    const data = await res.json();
    return data.translated_text || null;
  }

  // ── TRANSLATE PAGE ────────────────────────────────────────────────────────
  if (action === 'TRANSLATE_ALL_PAGE') {
    window.__vtStop = false;

    const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','CODE','PRE','BUTTON','SELECT']);
    const SKIP_IDS = new Set(['vt-popup-panel','vt-floating-icon','vt-selection-popup']);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.getAttribute('data-vt-undo')) return NodeFilter.FILTER_REJECT;
        if (p.classList.contains('vt-translated-inline') || p.classList.contains('vt-undo-btn')) return NodeFilter.FILTER_REJECT;
        for (const id of SKIP_IDS) { if (p.closest('#' + id)) return NodeFilter.FILTER_REJECT; }
        const text = node.textContent.trim();
        if (text.length < 3) return NodeFilter.FILTER_REJECT;
        const rect = p.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    // Batch: translate in groups of 5 concurrently
    const BATCH = 5;
    for (let i = 0; i < nodes.length; i += BATCH) {
      if (window.__vtStop) break;
      const batch = nodes.slice(i, i + BATCH);
      await Promise.all(batch.map(async (node) => {
        if (window.__vtStop) return;
        if (!node.parentNode) return;
        const text = node.textContent.trim();
        if (!text) return;
        try {
          const translated = await translateText(text, srcLang, lang);
          if (translated && node.parentNode) {
            node.parentNode.replaceChild(wrapTranslated(text, translated), node);
          }
        } catch { /* skip */ }
      }));
    }
    window.__vtStop = false;
  }

  // ── TRANSLATE SELECTION ───────────────────────────────────────────────────
  else if (action === 'TRANSLATE_SELECTION') {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text) return;

    let range;
    try { range = sel.getRangeAt(0); } catch { return; }

    // Highlight while loading
    let mark;
    try {
      mark = document.createElement('mark');
      mark.style.cssText = 'background:rgba(99,102,241,0.2);border-radius:2px;transition:background 0.3s;';
      range.surroundContents(mark);
    } catch {
      // Cross-element selection — just translate and show toast
      mark = null;
    }

    try {
      const translated = await translateText(text, srcLang, lang);
      if (!translated) throw new Error('no output');
      const span = wrapTranslated(text, translated);
      if (mark) {
        mark.replaceWith(span);
      } else {
        // Fallback: insert after selection
        range.collapse(false);
        range.insertNode(span);
      }
    } catch {
      if (mark) {
        // Unwrap mark
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
      }
    }
  }

  // ── CLICK MODE ────────────────────────────────────────────────────────────
  else if (action === 'TOGGLE_CLICK_MODE') {
    if (window.__vtClickMode) {
      // Turn off
      document.removeEventListener('mouseover', window.__vtHoverFn);
      document.removeEventListener('click', window.__vtClickFn, true);
      document.body.style.cursor = '';
      if (window.__vtHighlightEl) { window.__vtHighlightEl.style.outline = ''; window.__vtHighlightEl = null; }
      window.__vtClickMode = false;

      // Remove click-mode banner
      const banner = document.getElementById('vt-click-banner');
      if (banner) banner.remove();
      return;
    }

    window.__vtClickMode = true;
    document.body.style.cursor = 'crosshair';

    // Show a small banner so user knows click mode is on
    const banner = document.createElement('div');
    banner.id = 'vt-click-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(10,12,20,0.88)', 'backdrop-filter:blur(12px)',
      'border:1px solid rgba(99,102,241,0.4)', 'border-radius:12px',
      'padding:8px 16px', 'font-size:12px', 'font-weight:600',
      'color:rgba(255,255,255,0.85)', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'gap:8px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    ].join(';');
    banner.innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:#818cf8;box-shadow:0 0 6px #818cf8;flex-shrink:0;"></span>
      Click any text to translate
      <button id="vt-click-off" style="margin-left:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#f87171;font-size:10px;font-weight:700;padding:2px 8px;cursor:pointer;">✕ Stop</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('vt-click-off').addEventListener('click', () => {
      window.__vtAction = 'TOGGLE_CLICK_MODE';
      // re-trigger toggle off
      document.removeEventListener('mouseover', window.__vtHoverFn);
      document.removeEventListener('click', window.__vtClickFn, true);
      document.body.style.cursor = '';
      if (window.__vtHighlightEl) { window.__vtHighlightEl.style.outline = ''; window.__vtHighlightEl = null; }
      window.__vtClickMode = false;
      banner.remove();
    });

    window.__vtHoverFn = (e) => {
      const el = e.target;
      if (el.closest('#vt-click-banner') || el.closest('#vt-popup-panel') || el.closest('#vt-floating-icon')) return;
      if (window.__vtHighlightEl && window.__vtHighlightEl !== el) {
        window.__vtHighlightEl.style.outline = '';
      }
      window.__vtHighlightEl = el;
      el.style.outline = '2px solid rgba(99,102,241,0.7)';
    };

    window.__vtClickFn = async (e) => {
      const el = e.target;
      if (el.closest('#vt-click-banner') || el.closest('#vt-popup-panel') || el.closest('#vt-floating-icon')) return;
      if (el.getAttribute('data-vt-undo')) return;
      e.preventDefault();
      e.stopPropagation();

      if (window.__vtHighlightEl) { window.__vtHighlightEl.style.outline = ''; window.__vtHighlightEl = null; }

      const text = (el.innerText || el.textContent || '').replace(/↩/g, '').trim();
      if (!text || text.length < 2) return;

      // Visual feedback
      el.style.opacity = '0.5';
      el.style.transition = 'opacity 0.2s';

      try {
        const translated = await translateText(text, srcLang, lang);
        el.style.opacity = '';
        if (translated) {
          const orig = el.innerHTML;
          el.setAttribute('data-vt-original', orig);
          el.textContent = translated;
          const btn = document.createElement('button');
          btn.textContent = '↩';
          btn.setAttribute('data-vt-undo', '1');
          btn.title = 'Restore original';
          btn.style.cssText = 'font-size:9px;margin-left:4px;background:rgba(99,102,241,0.15);border:none;border-radius:3px;cursor:pointer;color:#818cf8;padding:0 3px;vertical-align:middle;';
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            el.innerHTML = orig;
            el.removeAttribute('data-vt-original');
          });
          el.appendChild(btn);
        }
      } catch {
        el.style.opacity = '';
      }
    };

    document.addEventListener('mouseover', window.__vtHoverFn);
    document.addEventListener('click', window.__vtClickFn, true);
  }

  // ── STOP / RESTORE ────────────────────────────────────────────────────────
  else if (action === 'STOP_TRANSLATION') {
    window.__vtStop = true;
    window.__vtClickMode = false;
    document.body.style.cursor = '';

    if (window.__vtHoverFn) document.removeEventListener('mouseover', window.__vtHoverFn);
    if (window.__vtClickFn) document.removeEventListener('click', window.__vtClickFn, true);
    if (window.__vtHighlightEl) { window.__vtHighlightEl.style.outline = ''; window.__vtHighlightEl = null; }

    const banner = document.getElementById('vt-click-banner');
    if (banner) banner.remove();

    // Restore all translated spans
    document.querySelectorAll('.vt-translated-inline').forEach(span => {
      const orig = span.getAttribute('data-vt-original') || span.textContent.replace(/↩/g, '').trim();
      span.replaceWith(document.createTextNode(orig));
    });

    // Restore click-translated elements
    document.querySelectorAll('[data-vt-original]').forEach(el => {
      el.innerHTML = el.getAttribute('data-vt-original');
      el.removeAttribute('data-vt-original');
    });

    setTimeout(() => { window.__vtStop = false; }, 100);
  }
})();
