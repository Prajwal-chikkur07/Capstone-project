import os
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Slack configuration from environment variables
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")


def send_to_slack_webhook(text: str, webhook_url: str = None, channel: str = None) -> dict:
    """
    Sends a message to Slack using an Incoming Webhook
    
    Args:
        text: Message text to send
        webhook_url: Slack webhook URL (optional if set in .env)
        channel: Optional channel override (e.g., "#general")
    
    Returns:
        dict with success status and message
    
    Setup:
        1. Go to https://api.slack.com/apps
        2. Create a new app or select existing
        3. Enable "Incoming Webhooks"
        4. Add webhook to workspace
        5. Copy webhook URL to .env as SLACK_WEBHOOK_URL
    """
    url = webhook_url or SLACK_WEBHOOK_URL
    
    if not url:
        raise Exception(
            "Slack webhook not configured. Provide webhook_url parameter or set SLACK_WEBHOOK_URL in .env. "
            "Get webhook URL from: https://api.slack.com/apps → Your App → Incoming Webhooks"
        )
    
    try:
        logger.info(f"Sending message to Slack via webhook")
        
        payload = {
            "text": text,
            "mrkdwn": True
        }
        
        if channel:
            payload["channel"] = channel
        
        response = requests.post(url, json=payload)
        
        if response.status_code == 200 and response.text == "ok":
            logger.info("Message sent successfully to Slack")
            return {
                "success": True,
                "message": "Message sent successfully to Slack",
                "provider": "Slack Webhook"
            }
        else:
            logger.error(f"Slack webhook error: {response.status_code} - {response.text}")
            raise Exception(f"Slack webhook error: {response.status_code} - {response.text}")
            
    except Exception as e:
        logger.error(f"Slack webhook error: {e}")
        raise Exception(f"Failed to send to Slack: {str(e)}")


def send_to_slack_api(text: str, channel: str, bot_token: str = None) -> dict:
    """
    Sends a message to Slack using the Web API (chat.postMessage)
    
    Args:
        text: Message text to send
        channel: Channel ID or name (e.g., "C1234567890" or "#general")
        bot_token: Slack bot token (optional if set in .env)
    
    Returns:
        dict with success status and message
    
    Setup:
        1. Go to https://api.slack.com/apps
        2. Create a new app or select existing
        3. Add "chat:write" bot token scope
        4. Install app to workspace
        5. Copy Bot User OAuth Token to .env as SLACK_BOT_TOKEN
    """
    token = bot_token or SLACK_BOT_TOKEN
    
    if not token:
        raise Exception(
            "Slack bot token not configured. Provide bot_token parameter or set SLACK_BOT_TOKEN in .env. "
            "Get bot token from: https://api.slack.com/apps → Your App → OAuth & Permissions"
        )
    
    try:
        logger.info(f"Sending message to Slack channel {channel} via API")
        
        url = "https://slack.com/api/chat.postMessage"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "channel": channel,
            "text": text,
            "mrkdwn": True
        }
        
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if data.get("ok"):
            logger.info(f"Message sent successfully to Slack channel {channel}")
            return {
                "success": True,
                "message": f"Message sent successfully to Slack channel {channel}",
                "provider": "Slack API",
                "channel": data.get("channel"),
                "ts": data.get("ts")
            }
        else:
            error = data.get("error", "Unknown error")
            logger.error(f"Slack API error: {error}")
            raise Exception(f"Slack API error: {error}")
            
    except Exception as e:
        logger.error(f"Slack API error: {e}")
        raise Exception(f"Failed to send to Slack: {str(e)}")


def send_to_slack(text: str, channel: str = None, webhook_url: str = None, use_api: bool = False) -> dict:
    """
    Sends a message to Slack using either Webhook or API
    
    Args:
        text: Message text to send
        channel: Channel for API method (required if use_api=True)
        webhook_url: Webhook URL (optional if set in .env)
        use_api: If True, use API; otherwise use webhook
    
    Returns:
        dict with success status and message
    """
    if use_api:
        if not channel:
            raise Exception("Channel is required when using Slack API")
        return send_to_slack_api(text, channel)
    else:
        return send_to_slack_webhook(text, webhook_url, channel)


def format_slack_message(text: str, tone: str = None, language: str = None) -> str:
    """
    Formats a message for Slack with markdown styling
    
    Args:
        text: The main text content
        tone: Optional tone style used
        language: Optional language
    
    Returns:
        Formatted Slack message with markdown
    """
    message = f"*🌍 Voice Translation App*\n\n{text}\n\n"
    
    if tone or language:
        message += "---\n"
        if tone:
            message += f"*Tone Style:* {tone}\n"
        if language:
            message += f"*Language:* {language}\n"
    
    message += "_Generated by Voice Translation App_"
    
    return message


def format_slack_blocks(text: str, tone: str = None, language: str = None) -> list:
    """
    Formats a message for Slack using Block Kit for rich formatting
    
    Args:
        text: The main text content
        tone: Optional tone style used
        language: Optional language
    
    Returns:
        List of Slack blocks
    """
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "🌍 Voice Translation App",
                "emoji": True
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": text
            }
        }
    ]
    
    if tone or language:
        context_elements = []
        if tone:
            context_elements.append(f"*Tone:* {tone}")
        if language:
            context_elements.append(f"*Language:* {language}")
        
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": " | ".join(context_elements)
                }
            ]
        })
    
    blocks.append({
        "type": "divider"
    })
    
    blocks.append({
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": "_Generated by Voice Translation App_"
            }
        ]
    })
    
    return blocks
