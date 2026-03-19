# Quick Start Guide - Task 1

## Installation

### Backend
```bash
cd language-translation-app/backend
pip install aiofiles
python main.py
```

### Frontend
```bash
cd language-translation-app/frontend
flutter pub get
flutter run -d chrome  # or your device
```

## Usage

### 1. Select Mode
Tap the 🎤 icon (top-right) → Choose mode:
- **Push-to-Talk**: Hold to record
- **Continuous**: Auto-detects speech
- **File Upload**: Select existing file

### 2. Record/Upload
- **Push-to-Talk**: Press & hold button
- **Continuous**: Tap to start, auto-stops
- **File Upload**: Tap to select file

### 3. Process
Audio automatically translates to English → Apply tone → Translate to native language

## Key Features

✅ Three recording modes  
✅ Voice Activity Detection (VAD)  
✅ File upload support (MP3, WAV, M4A, etc.)  
✅ 50MB file size limit  
✅ Chunked streaming for efficiency  
✅ Real-time amplitude visualization  
✅ Auto-stop after silence  

## Files Changed

### Backend
- `backend/main.py` - Enhanced audio endpoint
- `backend/requirements.txt` - Added aiofiles

### Frontend
- `frontend/lib/screens/home_screen.dart` - Complete rewrite with 3 modes
- `frontend/lib/services/api_service.dart` - Added byte upload method
- `frontend/pubspec.yaml` - No changes (already had dependencies)

## Quick Test

1. Start backend: `python backend/main.py`
2. Start frontend: `flutter run -d chrome`
3. Try Push-to-Talk: Hold button, speak, release
4. Try Continuous: Tap button, speak, wait for auto-stop
5. Try File Upload: Select an audio file

Done! 🎉
