const { ipcRenderer } = require('electron');

const API_BASE = 'http://127.0.0.1:8000/api';

// Close button
document.getElementById('closeBtn').addEventListener('click', () => {
  ipcRenderer.send('hide-panel');
});

// Translate button
document.getElementById('translateBtn').addEventListener('click', async () => {
  const text = document.getElementById('inputText').value.trim();
  const lang = document.getElementById('languageSelect').value;
  const output = document.getElementById('outputText');
  
  if (!text) {
    output.textContent = 'Please enter some text.';
    return;
  }
  
  const btn = document.getElementById('translateBtn');
  btn.textContent = 'Translating...';
  btn.disabled = true;
  output.textContent = '';
  
  try {
    const res = await fetch(`${API_BASE}/translate-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target_language: lang }),
    });
    
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    output.textContent = data.translated_text || 'No result.';
  } catch (err) {
    output.textContent = 'Translation failed. Make sure the backend is running.';
  } finally {
    btn.textContent = 'Translate';
    btn.disabled = false;
  }
});

// Ctrl+Enter to translate
document.getElementById('inputText').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    document.getElementById('translateBtn').click();
  }
});
