import os
import json
import httpx
import re
import hashlib
import redis.asyncio as redis
from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    provider: Optional[str] = 'auto'

class LLMAdapter:
    def __init__(self):
        try:
            self.redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
            self.redis_active = True
        except Exception:
            self.redis_client = None
            self.redis_active = False
            
        self.ollama_url = f"{os.getenv('OLLAMA_HOST', 'http://localhost:11434')}/api/chat"
        self.fallback_key = os.getenv("OPENROUTER_API_KEY")

        # Security allowlist regex (simple example)
        self.malicious_pattern = re.compile(r"(ignore previous instructions|/etc/passwd|system prompt)", re.IGNORECASE)

    async def check_rate_limit(self, api_key: str):
        if not self.redis_active:
            return # Skip rate limit checks in environments without Redis
        try:
            key = f"rl:{api_key}"
            requests = await self.redis_client.incr(key)
            if requests == 1:
                await self.redis_client.expire(key, 60) # 60 seconds window
            if requests > 100:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. 100 req/min.")
        except Exception:
            self.redis_active = False # Disable for future calls if it fails during execution

    def check_injection(self, messages: List[Message]):
        for m in messages:
            if self.malicious_pattern.search(m.content):
                raise HTTPException(status_code=400, detail="Malicious prompt detected.")

    async def _call_ollama(self, messages: List[Message]):
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "model": "qwen2.5:9b-q8_0",
                "messages": [m.model_dump() for m in messages],
                "stream": False
            }
            res = await client.post(self.ollama_url, json=payload)
            res.raise_for_status()
            data = res.json()
            return {"choices": [{"message": data["message"]}]}

    async def _call_fallback(self, messages: List[Message]):
        if not self.fallback_key:
            raise Exception("OpenRouter API key missing for fallback.")
        async with httpx.AsyncClient(timeout=15.0) as client:
            payload = {
                "model": "qwen/qwen-3.5-9b",
                "max_tokens": 1000,
                "messages": [{"role": m.role, "content": m.content} for m in messages]
            }

            headers = {
                "Authorization": f"Bearer {self.fallback_key}",
                "content-type": "application/json"
            }
            res = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
            res.raise_for_status()
            data = res.json()
            return {"choices": [{"message": {"role": "assistant", "content": data["choices"][0]["message"]["content"]}}]}

    async def chat(self, request: ChatRequest):
        self.check_injection(request.messages)

        # Cache check
        response = None
        cache_key = None
        if self.redis_active:
            try:
                messages_str = json.dumps([m.model_dump() for m in request.messages])
                cache_hash = hashlib.sha256(messages_str.encode()).hexdigest()
                cache_key = f"cache:{cache_hash}"
                cached = await self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                self.redis_active = False

        try:
            response = await self._call_ollama(request.messages)
        except Exception as e:
            print(f"Ollama failed, falling back to OpenRouter: {e}")
            try:
                response = await self._call_fallback(request.messages)
            except Exception as fallback_e:
                raise HTTPException(status_code=502, detail=f"All providers failed. Fallback Error: {fallback_e}")

        # Cache for 5 mins (300 secs)
        if self.redis_active and cache_key:
            try:
                await self.redis_client.set(cache_key, json.dumps(response), ex=300)
            except Exception:
                self.redis_active = False
        return response
