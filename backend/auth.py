import base64
import json
from typing import Optional
from fastapi import Header


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
        token = authorization.split(" ", 1)[1]
        try:
            payload_b64 = token.split(".")[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            user_id = payload.get("sub")
            if user_id:
                return user_id
        except Exception:
            pass  # Fall through to guest handling

    # ── Guest with unique session ID ──────────────────────────────────────────
    if x_guest_id:
        # Sanitise: only allow UUID-like characters to prevent injection
        sanitised = "".join(c for c in x_guest_id if c.isalnum() or c == "-")[:64]
        if sanitised:
            return f"guest_{sanitised}"

    return None
