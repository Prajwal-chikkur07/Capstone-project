# Quick Start Guide - Task 2 (TTS)

## Installation

### Backend
```bash
cd language-translation-app/backend
pip install gtts
python main.py
```

### Frontend
```bash
cd language-translation-app/frontend
flutter pub get  # audioplayers already included
flutter run -d chrome
```

## Usage

### 1. Generate Text
- Record audio or upload file (Task 1)
- Text automatically translates to English
- Apply tone styling
- Translate to native language

### 2. Listen to Audio
- Click 🔊 icon next to any text output
- Audio generates and plays automatically
- Click ⏹️ to stop playback

### 3. Available Playback
- **English Translation**: Listen in English
- **Styled Text**: Listen to tone-styled version
- **Native Translation**: Listen in target language (Hindi, Tamil, etc.)

## Key Features

✅ Text-to-Speech for all outputs  
✅ 11+ Indian languages supported  
✅ One-click playback  
✅ Visual playback indicators  
✅ Automatic stop on new playback  
✅ Works on web and mobile  
✅ gTTS (free) with Sarvam AI option  

## Files Changed

### Backend
- `backend/services/tts_service.py` - NEW: TTS service
- `backend/main.py` - Added `/api/text-to-speech` endpoint
- `backend/requirements.txt` - Added gtts

### Frontend
- `frontend/lib/services/api_service.dart` - Added `textToSpeech()` method
- `frontend/lib/screens/home_screen.dart` - Added playback controls and UI

## Quick Test

1. Start backend: `python backend/main.py`
2. Test TTS API:
   ```bash
   curl -X POST http://localhost:8000/api/text-to-speech \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello world", "language": "en"}' \
     --output test.mp3
   ```
3. Play test.mp3 to verify
4. Start frontend: `flutter run -d chrome`
5. Record audio → Click 🔊 to listen

## Supported Languages

- English (en)
- Hindi (hi-IN)
- Bengali (bn-IN)
- Tamil (ta-IN)
- Telugu (te-IN)
- Malayalam (ml-IN)
- Marathi (mr-IN)
- Gujarati (gu-IN)
- Kannada (kn-IN)
- Punjabi (pa-IN)
- Odia (or-IN)

## Optional: Use Sarvam AI TTS

For higher quality voices:

1. Ensure `SARVAM_API_KEY` is set in `.env`
2. Check your Sarvam tier supports TTS
3. In code, set `useSarvam: true` when calling TTS

Done! 🎉
