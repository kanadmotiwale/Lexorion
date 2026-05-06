import base64
import json
from typing import Optional
from fastapi import Header


def get_user_id(authorization: str = Header(None)) -> Optional[str]:
    """
    FastAPI dependency — extracts the Supabase user ID from the
    'Authorization: Bearer <token>' header.

    Returns None (guest access) if the header is absent or invalid,
    so every route decides independently how to handle unauthenticated users.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None  # Guest / unauthenticated

    token = authorization.split(" ", 1)[1]

    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub") or None
    except Exception:
        return None  # Treat malformed token as guest
