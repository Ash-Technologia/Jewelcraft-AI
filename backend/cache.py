"""
JewelCraft AI — Simple TTL In-Memory Cache
------------------------------------------
Provides a lightweight, thread-safe TTL cache.
Can be swapped for Redis by replacing the backend of `TTLCache`.
"""

import time
import threading
from typing import Any, Optional


class TTLCache:
    """
    A thread-safe in-memory key-value cache with per-entry TTL.
    
    Usage:
        cache = TTLCache(default_ttl=3600)
        cache.set("key", value)
        value = cache.get("key")  # None if expired
    """

    def __init__(self, default_ttl: int = 3600):
        self._store: dict[str, tuple[Any, float]] = {}  # {key: (value, expires_at)}
        self._lock = threading.Lock()
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        with self._lock:
            ttl = ttl if ttl is not None else self.default_ttl
            self._store[key] = (value, time.time() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def purge_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        now = time.time()
        with self._lock:
            expired = [k for k, (_, exp) in self._store.items() if now > exp]
            for k in expired:
                del self._store[k]
        return len(expired)

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)


# ── Shared application caches ──────────────────────────────────────────────────

metal_price_cache = TTLCache(default_ttl=3600)   # 1 hour for metal prices
concept_cache     = TTLCache(default_ttl=300)     # 5 min for concept generation
