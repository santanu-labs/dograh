"""Fetch ephemeral ICE servers from Cloudflare Realtime TURN.

Cloudflare does not speak coturn's TURN REST HMAC. Credentials are minted by
POSTing to their generate-ice-servers API and last at most 48 hours. Results
are cached in-process until shortly before expiry so a call does not wait on
Cloudflare on every offer.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Optional

import httpx
from loguru import logger

from api.constants import (
    CLOUDFLARE_TURN_API_TOKEN,
    CLOUDFLARE_TURN_KEY_ID,
    TURN_CREDENTIAL_TTL,
)

_GENERATE_ICE_SERVERS_URL = (
    "https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers"
)
_MAX_TTL_SECONDS = 48 * 60 * 60
_REFRESH_MARGIN_SECONDS = 3600
_HTTP_TIMEOUT_SECONDS = 10.0

_cache_lock = threading.Lock()
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _clamp_ttl(ttl: int) -> int:
    return max(60, min(int(ttl), _MAX_TTL_SECONDS))


def _cache_key(user_id: str) -> str:
    return user_id or "server"


def _get_cached(user_id: str) -> Optional[dict[str, Any]]:
    key = _cache_key(user_id)
    now = time.time()
    with _cache_lock:
        entry = _cache.get(key)
        if not entry:
            return None
        expires_at, creds = entry
        if expires_at <= now:
            _cache.pop(key, None)
            return None
        return creds


def _store_cache(user_id: str, creds: dict[str, Any], ttl: int) -> None:
    # Refresh before Cloudflare expires the allocation so a call mid-TTL
    # never presents a credential that dies during ICE.
    cache_for = max(60, ttl - _REFRESH_MARGIN_SECONDS)
    with _cache_lock:
        _cache[_cache_key(user_id)] = (time.time() + cache_for, creds)


def clear_cloudflare_turn_cache() -> None:
    """Drop cached credentials. Used by tests."""
    with _cache_lock:
        _cache.clear()


def _ice_servers_to_credentials(payload: dict[str, Any], ttl: int) -> dict[str, Any]:
    ice_servers = payload.get("iceServers") or []
    turn_uris: list[str] = []
    username: Optional[str] = None
    password: Optional[str] = None

    for server in ice_servers:
        urls = server.get("urls") or []
        if isinstance(urls, str):
            urls = [urls]
        if not server.get("username") or not server.get("credential"):
            continue
        username = server["username"]
        password = server["credential"]
        turn_uris.extend(url for url in urls if not str(url).startswith("stun:"))

    if not username or not password or not turn_uris:
        raise ValueError("Cloudflare TURN response missing credentialed iceServers")

    return {
        "username": username,
        "password": password,
        "ttl": ttl,
        "uris": turn_uris,
    }


def fetch_cloudflare_turn_credentials(
    user_id: str,
    ttl: int = TURN_CREDENTIAL_TTL,
) -> dict[str, Any]:
    """Mint (or return cached) Cloudflare TURN credentials for ``user_id``."""
    if not CLOUDFLARE_TURN_KEY_ID or not CLOUDFLARE_TURN_API_TOKEN:
        raise ValueError("Cloudflare TURN is not configured")

    ttl = _clamp_ttl(ttl)
    cached = _get_cached(user_id)
    if cached:
        return cached

    url = _GENERATE_ICE_SERVERS_URL.format(key_id=CLOUDFLARE_TURN_KEY_ID)
    # generate-ice-servers accepts ttl. customIdentifier is documented on the
    # sibling /credentials/generate endpoint; include it here for analytics
    # when Cloudflare accepts the field, and it is ignored otherwise.
    body = {"ttl": ttl, "customIdentifier": str(user_id)[:64]}
    headers = {
        "Authorization": f"Bearer {CLOUDFLARE_TURN_API_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            response = client.post(url, json=body, headers=headers)
            response.raise_for_status()
            creds = _ice_servers_to_credentials(response.json(), ttl)
    except httpx.HTTPError as exc:
        logger.error(f"Cloudflare TURN credential request failed: {exc}")
        raise

    _store_cache(user_id, creds, ttl)
    logger.info(f"Issued Cloudflare TURN credentials for {user_id!r}, TTL={ttl}s")
    return creds
