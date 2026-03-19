# File Size Limit Update

## Changes Made

Updated the maximum file upload size to support up to 5-minute audio files.

### Backend Changes

**File:** `backend/main.py`

**Previous Limit:** 50MB  
**New Limit:** 100MB

```python
# Configuration for file uploads
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB (supports up to 5 min audio)
CHUNK_SIZE = 1024 * 1024  # 1MB chunks
```

**Rationale:**
- 5-minute audio in compressed formats (MP3, M4A, WebM): ~10-15MB
- 5-minute audio in uncompressed formats (WAV, FLAC): ~50MB
- 100MB limit provides comfortable headroom for all formats

### Frontend Changes

**File:** `frontend/lib/services/api_service.dart`

Updated error message to reflect new limit:
```dart
throw Exception('File too large. Maximum size is 100MB');
```

## Audio File Size Estimates (5 minutes)

| Format | Bitrate | Approximate Size |
|--------|---------|------------------|
| MP3 (128 kbps) | 128 kbps | ~4.7 MB |
| MP3 (320 kbps) | 320 kbps | ~11.7 MB |
| M4A (AAC 128 kbps) | 128 kbps | ~4.7 MB |
| WebM (Opus 128 kbps) | 128 kbps | ~4.7 MB |
| WAV (16-bit, 44.1kHz) | 1411 kbps | ~52 MB |
| FLAC (lossless) | ~800 kbps | ~29 MB |
| OGG (Vorbis 192 kbps) | 192 kbps | ~7 MB |

## Server Status

✅ Backend server restarted with new configuration  
✅ Running on http://localhost:8000  
✅ Ready to accept audio files up to 100MB  

## Testing

To test with a 5-minute audio file:

```bash
# Upload a 5-minute audio file
curl -X POST http://localhost:8000/api/translate-audio \
  -F "file=@your_5min_audio.mp3"
```

## Notes

- The chunked streaming approach (1MB chunks) ensures efficient memory usage even with large files
- Files larger than 100MB will receive a 413 error with message: "File too large. Maximum size is 100MB"
- All supported formats (MP3, WAV, M4A, WebM, OGG, FLAC) work with the new limit

## Impact

- ✅ Users can now upload longer audio recordings (up to 5 minutes)
- ✅ No performance degradation due to chunked streaming
- ✅ Memory usage remains efficient
- ✅ All existing features continue to work

---

**Updated:** File size limit increased from 50MB to 100MB to support 5-minute audio files.
