import os
import base64
import json
from typing import Optional
from fastapi import Header

# Load the Supabase JWT secret for signature verification.
# Without this, tokens are decoded but NOT verified — only acceptable in local dev.
_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")


def _decode_jwt(token: str) -> Optional[dict]:
    """Decode and verify a Supabase JWT. Returns payload dict or None on failure."""
    if _JWT_SECRET:
        try:
            import jwt  # PyJWT
            # Supabase JWTs are HS256-signed; audience claim is not always present.
            payload = jwt.decode(
                token,
                _JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return payload
        except Exception:
            return None
    else:
        # No secret configured — fall back to unsigned decode (dev/test only).
        # A warning is intentionally NOT raised every request to avoid log spam.
        try:
            payload_b64 = token.split(".")[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            return json.loads(base64.urlsafe_b64decode(payload_b64))
        except Exception:
            return None


def get_user_id(
    authorization: str = Header(None),
    x_guest_id: str = Header(None),
) -> Optional[str]:
    """
    FastAPI dependency — returns the effective user ID for the request.

    Priority:
    1. Valid Supabase JWT → returns the UUID (sub claim)
    2. X-Guest-Id header  → returns 'guest_<uuid>' (per-browser isolation)
    3. Neither present    → returns None (treated as anonymous guest)
    """
    # ── Logged-in user ────────────────────────────────────────────────────────
    if authorization and authorization.startswith("Bearer "):
        token   = authorization.split(" ", 1)[1]
        payload = _decode_jwt(token)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                return user_id

    # ── Guest with unique session ID ──────────────────────────────────────────
    if x_guest_id:
        # Sanitise: only allow UUID-like characters to prevent injection
        sanitised = "".join(c for c in x_guest_id if c.isalnum() or c == "-")[:64]
        if sanitised:
            return f"guest_{sanitised}"

    return None
