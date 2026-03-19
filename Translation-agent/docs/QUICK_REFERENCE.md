# Quick Reference Card

## Installation (One Command)

```bash
# Backend
cd backend && pip install -r requirements.txt && python main.py

# Frontend (new terminal)
cd frontend && flutter pub get && flutter run -d chrome
```

## Essential Configuration

```env
# Required
SARVAM_API_KEY=your_key
GEMINI_API_KEY=your_key

# Optional - Email
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Optional - Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/translate-audio` | Audio → English |
| `POST /api/rewrite-tone` | Apply tone |
| `POST /api/translate-text` | English → Native |
| `POST /api/text-to-speech` | Text → Audio |
| `POST /api/send/email` | Send email |
| `POST /api/send/slack` | Send Slack |
| `POST /api/send/linkedin` | Share LinkedIn |

## Features at a Glance

### Voice Input (Task 1)
- 🎤 Push-to-Talk
- 👂 Continuous Listening (VAD)
- 📁 File Upload (6 formats)

### Audio Playback (Task 2)
- 🔊 English TTS
- 🔊 Styled Text TTS
- 🔊 Native Language TTS

### Share (Task 3)
- 📧 Email (SMTP/SendGrid)
- 💬 Slack (Webhook/API)
- 💼 LinkedIn (Mock/OAuth)

## Quick Tests

```bash
# Test TTS
curl -X POST http://localhost:8000/api/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "language": "en"}' \
  --output test.mp3

# Test Email
curl -X POST http://localhost:8000/api/send/email \
  -H "Content-Type: application/json" \
  -d '{"text": "Test", "to_email": "test@example.com"}'

# Test Slack
curl -X POST http://localhost:8000/api/send/slack \
  -H "Content-Type: application/json" \
  -d '{"text": "Test"}'
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Email not sending | Use Gmail App Password |
| Slack not working | Check webhook URL |
| TTS not generating | Check internet connection |
| File too large | Max 50MB |

## File Structure

```
backend/
├── main.py                    # All endpoints
├── services/
│   ├── sarvam_client.py      # Speech/translation
│   ├── gemini_client.py      # Tone styling
│   ├── tts_service.py        # Text-to-speech
│   ├── email_service.py      # Email integration
│   ├── slack_service.py      # Slack integration
│   └── linkedin_service.py   # LinkedIn integration
└── .env                       # Configuration

frontend/
├── lib/
│   ├── main.dart
│   ├── screens/
│   │   └── home_screen.dart  # Main UI
│   └── services/
│       └── api_service.dart  # API client
└── pubspec.yaml
```

## Supported Languages

English, Hindi, Bengali, Tamil, Telugu, Malayalam, Marathi, Gujarati, Kannada, Punjabi, Odia

## Documentation

- `TASK1_IMPLEMENTATION.md` - Voice input
- `TASK2_IMPLEMENTATION.md` - TTS
- `TASK3_IMPLEMENTATION.md` - Integrations
- `COMPLETE_IMPLEMENTATION_SUMMARY.md` - Full overview

## Get Help

1. Check documentation files
2. Review error messages
3. Test with curl commands
4. Verify .env configuration
5. Check API logs

---

**Quick Start:** Install → Configure → Run → Test → Deploy 🚀
