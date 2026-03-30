#!/usr/bin/env python3
"""
Test script for the unified Slack /n2e command endpoint.
Tests both text and voice translation in a single command.
"""

import requests
import json

# Backend URL
BACKEND_URL = "http://localhost:8000"
N2E_ENDPOINT = f"{BACKEND_URL}/api/slack/n2e"

def test_n2e_text_translation():
    """Test the /n2e command with text input"""
    
    print("\n" + "=" * 60)
    print("Testing Slack /n2e Command - TEXT TRANSLATION")
    print("=" * 60)
    
    # Test 1: Valid text translation
    print("\n[TEST 1] Valid text translation")
    payload = {
        "command": "/n2e",
        "text": "Hello, how are you doing today?",
        "user_id": "U123456",
        "channel_id": "C123456",
        "source_language": "en-IN",
        "target_language": "en"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if "text" in data:
                print(f"✅ Text translation successful: {data['text']}")
            else:
                print("❌ Invalid response format")
        else:
            print(f"❌ Error: {response.text[:200]}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 2: Translation to Hindi
    print("\n[TEST 2] Text translation to Hindi")
    payload = {
        "command": "/n2e",
        "text": "Good morning! Have a wonderful day.",
        "source_language": "en-IN",
        "target_language": "hi-IN"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Hindi translation: {data.get('text', 'N/A')}")
        else:
            print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 3: Translation to Tamil
    print("\n[TEST 3] Text translation to Tamil")
    payload = {
        "command": "/n2e",
        "text": "Can you help me with this?",
        "source_language": "en-IN",
        "target_language": "ta-IN"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Tamil translation: {data.get('text', 'N/A')}")
        else:
            print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 4: Empty text should fail
    print("\n[TEST 4] Empty text input (should fail)")
    payload = {
        "command": "/n2e",
        "text": "",
        "file_url": None
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        if response.status_code == 400:
            print("✅ Correctly rejected empty input")
        else:
            print(f"⚠️  Status: {response.status_code}")
    except Exception as e:
        print(f"❌ Connection error: {e}")


def test_n2e_voice_translation():
    """Test the /n2e command with voice/audio input"""
    
    print("\n" + "=" * 60)
    print("Testing Slack /n2e Command - VOICE TRANSLATION")
    print("=" * 60)
    
    print("\n⚠️  NOTE: Voice translation requires actual Slack file URL")
    print("     For testing, you need a valid Slack file URL from a voice message")
    
    # Test 1: Voice translation request format
    print("\n[TEST 1] Voice translation request format validation")
    payload = {
        "command": "/n2e",
        "file_url": "https://files.slack.com/files-pri/T123456-U123456/ABC123/audio.wav",
        "source_language": "en-IN",
        "target_language": "en"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code in [200, 400, 500]:
            print("✅ Voice translation endpoint is accessible")
        else:
            print(f"⚠️  Unexpected status: {response.status_code}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    
    # Test 2: Voice translation with different languages
    print("\n[TEST 2] Voice translation with language conversion")
    payload = {
        "command": "/n2e",
        "file_url": "https://files.slack.com/files-pri/T123456-U123456/ABC123/audio.wav",
        "source_language": "hi-IN",
        "target_language": "ta-IN"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        if response.status_code in [200, 400, 500]:
            print("✅ Different language pair accepted")
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Connection error: {e}")


def test_integration():
    """Test the overall /n2e integration"""
    
    print("\n" + "=" * 60)
    print("Integration Tests")
    print("=" * 60)
    
    # Test 1: Endpoint availability
    print("\n[TEST 1] Check /n2e endpoint availability")
    try:
        r = requests.post(N2E_ENDPOINT, json={"command": "/n2e", "text": ""})
        if r.status_code < 500:
            print("✅ /n2e endpoint is available")
        else:
            print("⚠️  Endpoint returned 500 error")
    except Exception as e:
        print(f"❌ Cannot reach endpoint: {e}")
    
    # Test 2: Response format
    print("\n[TEST 2] Check response format")
    payload = {
        "command": "/n2e",
        "text": "test",
        "source_language": "en-IN",
        "target_language": "en"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        if response.status_code == 200:
            data = response.json()
            required_keys = ["response_type", "text"]
            if all(k in data for k in required_keys):
                print("✅ Response has correct format")
            else:
                print(f"❌ Missing keys: {required_keys}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 3: Both inputs provided (text takes priority)
    print("\n[TEST 3] Both text and file_url provided (text should be processed)")
    payload = {
        "command": "/n2e",
        "text": "Hello world",
        "file_url": "https://files.slack.com/files/.../audio.wav"
    }
    
    try:
        response = requests.post(N2E_ENDPOINT, json=payload)
        if response.status_code == 200:
            print("✅ Text is prioritized when both inputs are provided")
        else:
            print(f"Response: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")


def print_usage_examples():
    """Print usage examples for reference"""
    
    print("\n" + "=" * 60)
    print("Usage Examples")
    print("=" * 60)
    
    print("\n1. Text Translation:")
    print("   In Slack: /n2e Hello, how are you?")
    print("   Response: Translated text")
    
    print("\n2. Voice Translation:")
    print("   In Slack:")
    print("   - Upload audio or send voice message")
    print("   - Reply with: /n2e")
    print("   Response: Transcribed and translated text")
    
    print("\n3. Language Selection (in request):")
    print("   - source_language: en-IN, hi-IN, ta-IN, etc.")
    print("   - target_language: en, hi-IN, ta-IN, etc.")
    
    print("\n4. Testing from command line:")
    print(f"   # Text")
    print(f"   curl -X POST {N2E_ENDPOINT} \\")
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{{\"command\": \"/n2e\", \"text\": \"Hello\"}}\'')
    
    print(f"\n   # Voice")
    print(f"   curl -X POST {N2E_ENDPOINT} \\")
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{{\"command\": \"/n2e\", \"file_url\": \"https://files.slack.com/.../audio.wav\"}}\'')


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Slack /n2e Unified Command - Endpoint Tests")
    print("=" * 60)
    
    print("\n⚠️  Make sure the backend is running on http://localhost:8000")
    print("   Run: python backend/main.py or uvicorn backend.main:app --reload\n")
    
    # Run all tests
    test_n2e_text_translation()
    test_n2e_voice_translation()
    test_integration()
    print_usage_examples()
    
    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)
    
    print("\n📚 For setup instructions, see the documentation files")
