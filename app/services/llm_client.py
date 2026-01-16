"""
LLM Client for Text-to-SQL Chat functionality.
Uses Anthropic Claude models for natural language to SQL conversion.
"""

import os
import re
from pathlib import Path
from anthropic import Anthropic, AsyncAnthropic
from dotenv import load_dotenv

# Load environment variables from Track-Blueb root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)

api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    print("[WARNING] ANTHROPIC_API_KEY not found - Chat functionality will be disabled")
    anthropic_client = None
    async_anthropic_client = None
else:
    anthropic_client = Anthropic(api_key=api_key)
    async_anthropic_client = AsyncAnthropic(api_key=api_key)


def _clean_json_response(response_text: str) -> str:
    """
    Robustly extracts and cleans JSON from LLM responses.
    Handles various markdown formats, code blocks, and extra text.
    """
    if not response_text:
        return "{}"
    
    text = response_text.strip()
    
    # Pattern 1: Extract content from ```json ... ``` blocks
    json_block_pattern = r'```(?:json)?\s*\n?([\s\S]*?)\n?```'
    matches = re.findall(json_block_pattern, text, re.IGNORECASE)
    if matches:
        text = matches[0].strip()
    else:
        text = re.sub(r'```(?:json)?', '', text, flags=re.IGNORECASE)
        text = text.replace('```', '')
    
    # Pattern 2: Try to find JSON object directly { ... }
    json_object_pattern = r'\{[\s\S]*\}'
    json_match = re.search(json_object_pattern, text)
    if json_match:
        text = json_match.group(0)
    
    text = text.strip()
    text = text.replace('\\"', '"')
    
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace:last_brace + 1]
    
    if not text.startswith('{'):
        print(f"[WARNING] Response doesn't look like JSON: {text[:100]}...")
        return "{}"
    
    return text


def call_llm(prompt: str, model_type: str = 'flash') -> str:
    """
    Calls the specified LLM provider and returns a JSON string (sync).
    """
    if not anthropic_client:
        raise Exception("ANTHROPIC_API_KEY not configured")
    
    system_prompt = "Output valid JSON only."
    
    if model_type == 'flash':
        try:
            message = anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )
            result = _clean_json_response(message.content[0].text)
            return result
        except Exception as e:
            print(f"[ERROR] Haiku API Error: {e}")
            raise Exception(f"Haiku API Error: {e}")

    elif model_type == 'pro':
        try:
            message = anthropic_client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )
            result = _clean_json_response(message.content[0].text)
            return result
        except Exception as e:
            print(f"[ERROR] Sonnet API Error: {e}")
            raise Exception(f"Sonnet API Error: {e}")

    else:
        raise Exception(f"Unknown model_type '{model_type}'")


def call_llm_raw(prompt: str, model_type: str = 'flash') -> str:
    """
    Calls the LLM and returns RAW response without JSON cleaning (sync).
    """
    if not anthropic_client:
        raise Exception("ANTHROPIC_API_KEY not configured")
    
    if model_type == 'flash':
        try:
            message = anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            result = message.content[0].text.strip()
            return result
        except Exception as e:
            raise Exception(f"Haiku API Error: {e}")

    elif model_type == 'pro':
        try:
            message = anthropic_client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            result = message.content[0].text.strip()
            return result
        except Exception as e:
            raise Exception(f"Sonnet API Error: {e}")

    else:
        raise Exception(f"Unknown model_type '{model_type}'")


async def call_llm_raw_async(prompt: str, model_type: str = 'flash') -> str:
    """
    Async version - Calls the LLM and returns RAW response.
    Use this for parallel calls with asyncio.gather().
    """
    if not async_anthropic_client:
        raise Exception("ANTHROPIC_API_KEY not configured")
    
    if model_type == 'flash':
        try:
            message = await async_anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            result = message.content[0].text.strip()
            return result
        except Exception as e:
            raise Exception(f"Async Haiku Error: {e}")

    elif model_type == 'pro':
        try:
            message = await async_anthropic_client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            result = message.content[0].text.strip()
            return result
        except Exception as e:
            raise Exception(f"Async Sonnet Error: {e}")

    else:
        raise Exception(f"Unknown model_type '{model_type}'")
