"""TURN credential helpers used by signaling, embed, and /health."""

from api.constants import (
    CLOUDFLARE_TURN_API_TOKEN,
    CLOUDFLARE_TURN_KEY_ID,
    ENABLE_COTURN,
    TURN_SECRET,
)


def cloudflare_turn_configured() -> bool:
    """Return whether Cloudflare Realtime TURN keys are present."""
    return bool(CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN)


def turn_credentials_available() -> bool:
    """Return whether this process can mint browser/server TURN credentials.

    ENABLE_COTURN is the deployment's declared "we have TURN" flag. The
    secret-or-Cloudflare check is what actually lets us issue credentials —
    coturn HMAC needs TURN_SECRET; Cloudflare Realtime needs the key + token.
    """
    return ENABLE_COTURN and (bool(TURN_SECRET) or cloudflare_turn_configured())
