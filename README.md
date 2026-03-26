
> Backend:
cd Translation-agent/Translate-agent/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

> Frontend:
cd Translation-agent/Translate-agent/react-frontend
npm run dev

> Chrome Extension:
cd chrome-extension
npm run build

After the extension builds:
1. Open Chrome → chrome://extensions
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the chrome-extension/dist folder

---


Built with React + FastAPI. Powered by Sarvam AI and Google Gemini.

Deployment:
- Frontend: https://seedlingspeaks.vercel.app
- Backend: https://seedlingspeaks.onrender.com
