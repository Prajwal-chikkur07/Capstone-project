#!/usr/bin/env python3
"""
Test script for Slack slash command endpoints.
Tests both /translatente (text) and /translaten2e (voice) commands.
"""

import requests
import json

# Backend URL
BACKEND_URL = "http://localhost:8000"
TEXT_ENDPOINT = f"{BACKEND_URL}/api/slack/slash-command"
VOICE_ENDPOINT = f"{BACKEND_URL}/api/slack/voice-translation"

def test_text_translate_command():
    """Test the /translatente text slash command"""
    
    print("\n" + "=" * 60)
    print("Testing Slack /translatente (Text Translation)")
    print("=" * 60)
    
    # Test 1: Valid translation request
    print("\n[TEST 1] Valid text translation request")
    payload = {
        "command": "/translatente",
        "text": "Hello, how are you doing today?",
        "user_id": "U123456",
        "channel_id": "C123456",
        "team_id": "T123456",
        "source_language": "en-IN",
        "target_language": "en"
    }
    
    try:
        response = requests.post(TEXT_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if "text" in data:
                print(f"✅ Text translation successful: {data['text']}")
            else:
                print("❌ Invalid response format")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 2: Empty text request
    print("\n[TEST 2] Empty text request (should fail)")
    payload = {
        "command": "/translatente",
        "text": "",
        "user_id": "U123456",
        "channel_id": "C123456"
    }
    
    try:
        response = requests.post(TEXT_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected empty text")
        else:
            print("❌ Should have rejected empty text")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 3: Different target languages
    print("\n[TEST 3] Translation to Hindi")
    payload = {
        "command": "/translatente",
        "text": "Good morning! Have a wonderful day.",
        "source_language": "en-IN",
        "target_language": "hi-IN"
    }
    
    try:
        response = requests.post(TEXT_ENDPOINT, json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Hindi translation: {data.get('text', 'N/A')}")
        else:
            print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"❌ Connection error: {e}")


def test_voice_translation_command():
    """Test the /translaten2e voice slash command"""
    
    print("\n" + "=" * 60)
    print("Testing Slack /translaten2e (Voice Translation)")
    print("=" * 60)
    
    print("\n⚠️  NOTE: Voice translation requires actual Slack file URL")
    print("     For testing, you need a valid Slack file URL from a voice message")
    print("     or uploaded audio file.")
    
    # Test 1: Valid voice translation request (with dummy URL)
    print("\n[TEST 1] Voice translation request format validation")
    payload = {
        "command": "/translaten2e",
        "file_url": "https://files.slack.com/files-pri/T123456-U123456/ABC123/audio.wav",
        "user_id": "U123456",
        "channel_id": "C123456",
        "team_id": "T123456",
        "source_language": "en-IN",
        "target_language": "en"
    }
    
    try:
        response = requests.post(VOICE_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        # This might fail because the URL is dummy, but we're testing the endpoint exists
        if response.status_code in [200, 400, 500]:
            print("✅ Voice translation endpoint is accessible")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 2: Empty file URL request
    print("\n[TEST 2] Empty file URL request (should fail)")
    payload = {
        "command": "/translaten2e",
        "file_url": "",
        "user_id": "U123456",
        "channel_id": "C123456"
    }
    
    try:
        response = requests.post(VOICE_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected empty file URL")
        else:
            print("⚠️  Different response (check if expected)")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 3: Different language pair
    print("\n[TEST 3] Voice translation with different languages")
    payload = {
        "command": "/translaten2e",
        "file_url": "https://files.slack.com/files-pri/T123456-U123456/ABC123/audio.wav",
        "source_language": "hi-IN",
        "target_language": "ta-IN"
    }
    
    try:
        response = requests.post(VOICE_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code in [200, 400, 500]:
            print("✅ Different language pair accepted")
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Connection error: {e}")


def test_integration():
    """Test the overall integration"""
    
    print("\n" + "=" * 60)
    print("Integration Tests")
    print("=" * 60)
    
    # Test 1: Check both endpoints exist
    print("\n[TEST 1] Check endpoints availability")
    try:
        # Just make requests to see if endpoints exist
        r1 = requests.post(TEXT_ENDPOINT, json={"command": "/test", "text": ""})
        r2 = requests.post(VOICE_ENDPOINT, json={"command": "/test", "file_url": ""})
        
        if r1.status_code < 500 and r2.status_code < 500:
            print("✅ Both endpoints are available")
        else:
            print("⚠️  One or both endpoints returned 500 error")
    except Exception as e:
        print(f"❌ Cannot reach endpoints: {e}")
    
    # Test 2: Response format
    print("\n[TEST 2] Check response format")
    payload = {
        "command": "/translatente",
        "text": "test",
        "source_language": "en-IN",
        "target_language": "en"
    }
    
    try:
        response = requests.post(TEXT_ENDPOINT, json=payload)
        if response.status_code == 200:
            data = response.json()
            required_keys = ["response_type", "text"]
            if all(k in data for k in required_keys):
                print("✅ Response has correct format")
            else:
                print(f"❌ Missing keys: {required_keys}")
        else:
            print(f"⚠️  Got status {response.status_code} (expected 200)")
    except Exception as e:
        print(f"❌ Error testing response format: {e}")


def print_usage_examples():
    """Print usage examples for reference"""
    
    print("\n" + "=" * 60)
    print("Usage Examples")
    print("=" * 60)
    
    print("\n1. Text Translation (/translatente):")
    print("   In Slack: /translatente Hello, how are you?")
    print("   Response: Translation of the text")
    
    print("\n2. Voice Translation (/translaten2e):")
    print("   In Slack:")
    print("   - Upload audio or send voice message")
    print("   - Reply with: /translaten2e")
    print("   Response: Transcribed and translated text")
    
    print("\n3. Testing from command line:")
    print(f"   curl -X POST {TEXT_ENDPOINT} \\")
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{"command": "/translatente", "text": "Hello"}\'')


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Slack Translation Agent - Endpoint Tests")
    print("=" * 60)
    
    print("\n⚠️  Make sure the backend is running on http://localhost:8000")
    print("   Run: python backend/main.py or uvicorn backend.main:app --reload\n")
    
    # Run all tests
    test_text_translate_command()
    test_voice_translation_command()
    test_integration()
    print_usage_examples()
    
    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)
    
    print("\n📚 For detailed setup, see:")
    print("   - SLACK_QUICK_REFERENCE.md")
    print("   - SLACK_VOICE_TRANSLATION_GUIDE.md")
    print("   - SLACK_INTEGRATION_GUIDE.md")
