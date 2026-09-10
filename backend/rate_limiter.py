"""
JewelCraft AI — Sliding Window Rate Limiter
-------------------------------------------
Protects expensive AI endpoints (analyze, generate) from abuse.
Uses a sliding window algorithm stored in memory.
Can be replaced by Redis-backed slowapi for production at scale.

Default: 10 requests per minute per IP for AI endpoints.
         60 requests per minute per IP for general endpoints.
"""

import time
import threading
from collections import defaultdict, deque
from typing import Optional
from fastapi import Request, HTTPException


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter.
    
    Each IP gets its own deque of request timestamps.
    On each request, we purge timestamps older than the window
    and check if the count exceeds the limit.
    """

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> tuple[bool, int, int]:
        """
        Check if request is allowed.
        Returns: (allowed, remaining, retry_after_seconds)
        """
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            dq = self._windows[key]

            # Purge old entries
            while dq and dq[0] < window_start:
                dq.popleft()

            count = len(dq)
            if count >= self.max_requests:
                # Compute retry-after as time until oldest request expires
                retry_after = int(dq[0] + self.window_seconds - now) + 1 if dq else self.window_seconds
                return False, 0, retry_after

            dq.append(now)
            remaining = self.max_requests - count - 1
            return True, remaining, 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._windows.pop(key, None)

    def purge_idle(self, max_age: int = 300) -> int:
        """Remove entries for IPs that haven't made requests in max_age seconds."""
        now = time.time()
        with self._lock:
            idle = [k for k, dq in self._windows.items() if not dq or now - dq[-1] > max_age]
            for k in idle:
                del self._windows[k]
        return len(idle)


# ── Shared rate limiters ────────────────────────────────────────────────────────

import os

_AI_LIMIT     = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "10"))
_GENERAL_LIMIT = 60

ai_limiter      = SlidingWindowRateLimiter(max_requests=_AI_LIMIT,      window_seconds=60)
general_limiter = SlidingWindowRateLimiter(max_requests=_GENERAL_LIMIT, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For for reverse proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_ai_rate_limit(request: Request) -> None:
    """
    Dependency / helper to enforce the AI rate limit.
    Call this inside endpoint handlers for /api/analyze and /api/generate.
    Raises HTTP 429 if over limit.
    """
    ip = get_client_ip(request)
    allowed, remaining, retry_after = ai_limiter.is_allowed(ip)

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {_AI_LIMIT} AI requests/min. Retry after {retry_after}s.",
            headers={"Retry-After": str(retry_after), "X-RateLimit-Remaining": "0"},
        )


def enforce_general_rate_limit(request: Request) -> None:
    """Enforce general rate limit for non-AI endpoints."""
    ip = get_client_ip(request)
    allowed, remaining, retry_after = general_limiter.is_allowed(ip)

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Retry after {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
