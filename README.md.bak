# 🌍 Voice Translation App

A full-stack multilingual voice translation application that converts speech from Indian regional languages to English, applies tone styling, and translates back to native languages. Built with Flutter (frontend) and FastAPI (backend), powered by Sarvam AI and Google Gemini.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [Supported Languages](#supported-languages)
- [How It Works](#how-it-works)
- [Usage Guide](#usage-guide)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This application provides a seamless workflow for multilingual communication:

1. **Voice Input**: Record audio in any supported Indian regional language
2. **Speech-to-Text Translation**: Convert speech to English text using Sarvam AI
3. **Tone Styling**: Apply professional tone styles (Email, Slack, LinkedIn) using Google Gemini
4. **Text Translation**: Translate styled English text back to any Indian regional language

Perfect for professionals who need to communicate across language barriers while maintaining appropriate tone and context.

---

## ✨ Features

### Core Functionality
- 🎤 **Voice Recording**: Record audio directly from browser or mobile device
- 🗣️ **Speech-to-Text Translation**: Automatic transcription and translation to English
- 🎨 **Tone Styling**: Apply predefined or custom tone styles to text
- 🌐 **Multi-Language Support**: Translate to 10+ Indian regional languages
- 📱 **Cross-Platform**: Works on Web, Android, and iOS

### Tone Styles
- **Email Formal**: Professional language with proper salutations
- **Email Casual**: Friendly but professional, conversational
- **Slack**: Casual, short messages with emoji support
- **LinkedIn**: Thought leadership tone with hashtag suggestions
- **User Override**: Custom tone descriptions

### Supported Languages
Hindi, Bengali, Tamil, Telugu, Malayalam, Marathi, Gujarati, Kannada, Punjabi, Odia

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Flutter Frontend                         │
│  (Web/Android/iOS - Material Design UI)                     │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/REST API
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   FastAPI Backend                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/translate-audio    (Audio → English)           │  │
│  │  /api/rewrite-tone       (Tone Styling)              │  │
│  │  /api/translate-text     (English → Native)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
┌───────▼────────┐  ┌────────▼─────────┐
│   Sarvam AI    │  │  Google Gemini   │
│                │  │                  │
│ • Speech-to-   │  │ • Tone Rewriting │
│   Text         │  │ • Style          │
│ • Translation  │  │   Application    │
└────────────────┘  └──────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Flutter 3.11+
- **Language**: Dart
- **Key Packages**:
  - `http`: REST API communication
  - `record`: Audio recording
  - `permission_handler`: Microphone permissions
  - `path_provider`: File system access
  - `audioplayers`: Audio playback

### Backend
- **Framework**: FastAPI (Python)
- **Server**: Uvicorn
- **Key Libraries**:
  - `fastapi`: Web framework
  - `pydantic`: Data validation
  - `requests`: HTTP client for external APIs
  - `python-dotenv`: Environment variable management
  - `google-generativeai`: Gemini AI integration
  - `python-multipart`: File upload handling

### External APIs
- **Sarvam AI**: Speech-to-text translation and text translation
- **Google Gemini 2.5 Flash**: AI-powered tone rewriting

---

## 📁 Project Structure

```
language-translation-app/
├── backend/
│   ├── main.py                      # FastAPI application entry point
│   ├── requirements.txt             # Python dependencies
│   ├── .env                         # API keys (not in git)
│   └── services/
│       ├── sarvam_client.py        # Sarvam AI integration
│       └── gemini_client.py        # Google Gemini integration
│
├── frontend/
│   ├── lib/
│   │   ├── main.dart               # Flutter app entry point
│   │   ├── screens/
│   │   │   └── home_screen.dart    # Main UI screen
│   │   └── services/
│   │       └── api_service.dart    # Backend API client
│   ├── pubspec.yaml                # Flutter dependencies
│   └── android/ios/web/            # Platform-specific configs
│
└── README.md                        # This file
```

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.8+
- Flutter 3.11+
- Sarvam AI API Key ([Get it here](https://www.sarvam.ai/))
- Google Gemini API Key ([Get it here](https://ai.google.dev/))

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd language-translation-app/backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory:
   ```env
   SARVAM_API_KEY=your_sarvam_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. **Run the server**:
   ```bash
   python main.py
   ```
   Server will start at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd language-translation-app/frontend
   ```

2. **Install Flutter dependencies**:
   ```bash
   flutter pub get
   ```

3. **Update API endpoint** (if needed):
   Edit `lib/services/api_service.dart`:
   ```dart
   static const String baseUrl = 'http://YOUR_IP:8000/api';
   ```
   - Use `127.0.0.1` for web
   - Use your machine's IP for physical devices

4. **Run the app**:
   ```bash
   # For web
   flutter run -d chrome

   # For Android
   flutter run -d android

   # For iOS
   flutter run -d ios
   ```

---

## 🔌 API Endpoints

### 1. Translate Audio
**Endpoint**: `POST /api/translate-audio`

**Description**: Converts audio from Indian regional languages to English text

**Request**:
- Content-Type: `multipart/form-data`
- Body: Audio file (webm, wav, mp3, ogg, flac, m4a)

**Response**:
```json
{
  "transcript": "Hello, how are you?"
}
```

**Supported Audio Formats**: webm, wav, mp3, ogg, flac, m4a

---

### 2. Rewrite Tone
**Endpoint**: `POST /api/rewrite-tone`

**Description**: Applies tone styling to English text using Google Gemini

**Request**:
```json
{
  "text": "Hello, how are you?",
  "tone": "Email Formal",
  "user_override": null
}
```

**Response**:
```json
{
  "rewritten_text": "Dear Sir/Madam,\n\nI hope this message finds you well..."
}
```

**Available Tones**:
- `Email Formal`
- `Email Casual`
- `Slack`
- `LinkedIn`
- `User Override` (with custom description)

---

### 3. Translate Text
**Endpoint**: `POST /api/translate-text`

**Description**: Translates English text to Indian regional languages

**Request**:
```json
{
  "text": "Hello, how are you?",
  "target_language": "hi-IN"
}
```

**Response**:
```json
{
  "translated_text": "नमस्ते, आप कैसे हैं?"
}
```

---

## 🌐 Supported Languages

| Language   | Code    |
|------------|---------|
| Hindi      | hi-IN   |
| Bengali    | bn-IN   |
| Tamil      | ta-IN   |
| Telugu     | te-IN   |
| Malayalam  | ml-IN   |
| Marathi    | mr-IN   |
| Gujarati   | gu-IN   |
| Kannada    | kn-IN   |
| Punjabi    | pa-IN   |
| Odia       | or-IN   |

---

## 🔄 How It Works

### Workflow Diagram

```
┌──────────────┐
│ User Records │
│ Audio (Hindi)│
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│ Sarvam AI                │
│ Speech-to-Text-Translate │
│ (Hindi → English)        │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ English Text:            │
│ "Hello, how are you?"    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Google Gemini            │
│ Tone Styling             │
│ (Apply Email Formal)     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Styled Text:             │
│ "Dear Sir/Madam,..."     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Sarvam AI Translation    │
│ (English → Tamil)        │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Final Output (Tamil)     │
└──────────────────────────┘
```

### Step-by-Step Process

1. **Audio Recording**:
   - User clicks microphone button
   - Browser/app requests microphone permission
   - Audio is recorded in webm (web) or m4a (mobile) format

2. **Speech-to-Text Translation**:
   - Audio file is sent to backend
   - Backend forwards to Sarvam AI's `speech-to-text-translate` API
   - Sarvam AI detects source language and translates to English
   - English transcript is returned to frontend

3. **Tone Styling**:
   - User selects desired tone (or provides custom description)
   - English text is sent to backend with tone preference
   - Backend uses Google Gemini to rewrite text in specified tone
   - Styled text is displayed to user

4. **Native Language Translation**:
   - User selects target language (e.g., Tamil)
   - Styled English text is sent to backend
   - Backend uses Sarvam AI's `translate` API
   - Translated text is displayed in native script

---

## 📖 Usage Guide

### Recording Audio

1. Click the microphone button
2. Allow microphone permissions when prompted
3. Speak in your native language
4. Click the stop button when finished
5. Wait for automatic translation to English

### Applying Tone Styles

1. After audio translation, select a tone from the dropdown:
   - **Email Formal**: For professional correspondence
   - **Email Casual**: For friendly emails
   - **Slack**: For team messaging
   - **LinkedIn**: For professional networking
   - **User Override**: For custom tone descriptions

2. For custom tones:
   - Select "User Override"
   - Enter your tone description (e.g., "Formal but with bullet points")
   - Click "Apply Custom Tone"

### Translating to Native Language

1. Review the styled English text
2. Select your target language from the dropdown
3. Click "Translate to Native"
4. Copy the translated text for use

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Sarvam AI API Key
# Get from: https://www.sarvam.ai/
SARVAM_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxx

# Google Gemini API Key
# Get from: https://ai.google.dev/
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Security Notes**:
- Never commit `.env` files to version control
- Add `.env` to `.gitignore`
- Regenerate keys if accidentally exposed
- Use environment-specific keys for production

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: `SARVAM_API_KEY is not set`
- **Solution**: Ensure `.env` file exists in `backend/` directory with valid API key

**Problem**: `Sarvam API Error: 401`
- **Solution**: Check if your Sarvam API key is valid and has sufficient credits

**Problem**: `Gemini API Error`
- **Solution**: Verify Gemini API key and check if the API is enabled in Google Cloud Console

**Problem**: CORS errors
- **Solution**: Backend already has CORS enabled for all origins. Check if backend is running.

### Frontend Issues

**Problem**: "Failed to translate audio"
- **Solution**: 
  - Ensure backend is running at `http://localhost:8000`
  - Check network connectivity
  - Verify audio format is supported

**Problem**: Microphone permission denied
- **Solution**: 
  - Grant microphone permissions in browser/device settings
  - On web: Check browser console for permission errors
  - On mobile: Check app permissions in device settings

**Problem**: "Could not read recorded audio from browser"
- **Solution**: 
  - Try a different browser (Chrome recommended)
  - Clear browser cache
  - Check if microphone is working in other apps

**Problem**: Connection refused on physical device
- **Solution**: 
  - Update `baseUrl` in `api_service.dart` to your machine's IP
  - Ensure device and computer are on same network
  - Check firewall settings

### Audio Format Issues

**Problem**: "Unsupported audio format"
- **Solution**: 
  - Web: Browser should record in webm (opus codec)
  - Mobile: App records in m4a (aac codec)
  - Both formats are supported by Sarvam AI

---

## 🎨 UI Features

- **Material Design 3**: Modern, clean interface
- **Responsive Layout**: Works on all screen sizes
- **Real-time Feedback**: Loading indicators and error messages
- **Selectable Text**: Easy copying of translations
- **Color-coded Sections**: Clear visual separation of workflow steps

---

## 🔮 Future Enhancements

- [ ] Audio playback of translated text (Text-to-Speech)
- [ ] Translation history and favorites
- [ ] Offline mode with cached translations
- [ ] Multiple audio file upload
- [ ] Real-time streaming translation
- [ ] User authentication and profiles
- [ ] Custom tone presets
- [ ] Export translations to various formats

---

## 📄 License

This project is for educational and demonstration purposes.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [Sarvam AI Documentation](https://docs.sarvam.ai/)
3. Review [Google Gemini Documentation](https://ai.google.dev/docs)

---

## 🙏 Acknowledgments

- **Sarvam AI**: For providing excellent Indian language AI services
- **Google Gemini**: For powerful text generation capabilities
- **Flutter Team**: For the amazing cross-platform framework
- **FastAPI**: For the modern, fast web framework

---

**Built with ❤️ for multilingual communication**