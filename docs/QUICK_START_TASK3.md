# Quick Start Guide - Task 3 (Integrations)

## Installation

### Backend
```bash
cd language-translation-app/backend
# No new dependencies needed!
python main.py
```

### Frontend
```bash
cd language-translation-app/frontend
flutter pub get
flutter run -d chrome
```

## Quick Configuration

### 1. Email (Gmail)

**Get App Password:**
1. Enable 2FA: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Copy 16-character password

**Update .env:**
```env
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
```

### 2. Slack (Webhook)

**Get Webhook URL:**
1. Go to: https://api.slack.com/apps
2. Create app → Incoming Webhooks → Add to Workspace
3. Copy webhook URL

**Update .env:**
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. LinkedIn (Optional)

**Mock Mode (Default):**
- No configuration needed
- Uses mock responses for testing

**Real Mode (Advanced):**
- Requires OAuth 2.0 implementation
- See TASK3_IMPLEMENTATION.md for details

## Usage

### 1. Generate Styled Text
- Record audio or upload file
- Apply tone styling
- See "Share to:" section appear

### 2. Share via Email
- Click Email button
- Enter recipient email
- Enter subject (optional)
- Click Send

### 3. Share via Slack
- Click Slack button
- Enter webhook URL (optional if configured)
- Click Send

### 4. Share via LinkedIn
- Click LinkedIn button
- Review preview
- Click Share (uses mock mode)

## Key Features

✅ Email integration (SMTP/SendGrid)  
✅ Slack integration (Webhook/API)  
✅ LinkedIn integration (Mock/OAuth)  
✅ Beautiful email templates  
✅ Slack markdown formatting  
✅ LinkedIn hashtag generation  
✅ Input validation  
✅ Error handling  
✅ Success feedback  

## Files Changed

### Backend
- `backend/services/email_service.py` - NEW
- `backend/services/slack_service.py` - NEW
- `backend/services/linkedin_service.py` - NEW
- `backend/main.py` - Added 3 endpoints
- `backend/.env` - Added configuration

### Frontend
- `frontend/lib/services/api_service.dart` - Added 3 methods
- `frontend/lib/screens/home_screen.dart` - Added share UI

## Quick Test

### Test Email
```bash
curl -X POST http://localhost:8000/api/send/email \
  -H "Content-Type: application/json" \
  -d '{"text": "Test", "to_email": "test@example.com"}'
```

### Test Slack
```bash
curl -X POST http://localhost:8000/api/send/slack \
  -H "Content-Type: application/json" \
  -d '{"text": "Test", "webhook_url": "YOUR_URL"}'
```

### Test LinkedIn
```bash
curl -X POST http://localhost:8000/api/send/linkedin \
  -H "Content-Type: application/json" \
  -d '{"text": "Test", "use_mock": true}'
```

## Troubleshooting

**Email not sending:**
- Check SMTP_USERNAME and SMTP_PASSWORD
- Use App Password, not account password
- Enable 2FA on Gmail

**Slack not working:**
- Verify webhook URL format
- Check webhook is active in Slack
- Test webhook with curl

**LinkedIn shows mock:**
- This is expected (OAuth not implemented)
- Use mock mode for testing
- Implement OAuth for production

## Configuration Files

**Backend .env:**
```env
# Email
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# LinkedIn (optional)
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_PERSON_URN=
```

## New API Endpoints

- `POST /api/send/email` - Send via email
- `POST /api/send/slack` - Send to Slack
- `POST /api/send/linkedin` - Share to LinkedIn

Done! 🎉
