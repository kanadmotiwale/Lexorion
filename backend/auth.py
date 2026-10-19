import os
import logging
from typing import Optional
from fastapi import Header

logger = logging.getLogger("lexorion.auth")

# Supabase signs access tokens either with a shared secret (HS256, legacy projects)
# or with an asymmetric key (ES256/RS256, newer projects) published via JWKS.
# Tokens are ALWAYS verified — an unverifiable token is treated as "no token".
_JWT_SECRET   = os.getenv("SUPABASE_JWT_SECRET")
_SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")

_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None and _SUPABASE_URL:
        import jwt
        _jwks_client = jwt.PyJWKClient(f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def _decode_jwt(token: str) -> Optional[dict]:
    """Verify a Supabase JWT. Returns the payload dict, or None if it can't be verified."""
    import jwt
    try:
        alg = jwt.get_unverified_header(token).get("alg")

        if alg == "HS256" and _JWT_SECRET:
            key = _JWT_SECRET
        elif alg in ("ES256", "RS256") and _get_jwks_client():
            key = _get_jwks_client().get_signing_key_from_jwt(token).key
        else:
            logger.warning(
                "Cannot verify JWT with alg=%s — set SUPABASE_JWT_SECRET (HS256) "
                "or SUPABASE_URL (ES256/RS256).", alg,
            )
            return None

        return jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except Exception as exc:
        logger.warning("JWT rejected: %s", exc)
        return None


def get_user_id(
    authorization: str = Header(None),
    x_guest_id: str = Header(None),
) -> Optional[str]:
    """
    FastAPI dependency — returns the effective user ID for the request.

    Priority:
    1. Verified Supabase JWT → returns the UUID (sub claim)
    2. X-Guest-Id header     → returns 'guest_<uuid>' (per-browser isolation)
    3. Neither present       → returns None (treated as anonymous guest)
    """
    # ── Logged-in user ────────────────────────────────────────────────────────
    if authorization and authorization.startswith("Bearer "):
        token   = authorization.split(" ", 1)[1]
        payload = _decode_jwt(token)
        if payload:
            return payload["sub"]

    # ── Guest with unique session ID ──────────────────────────────────────────
    if x_guest_id:
        # Sanitise: only allow UUID-like characters to prevent injection
        sanitised = "".join(c for c in x_guest_id if c.isalnum() or c == "-")[:64]
        if sanitised:
            return f"guest_{sanitised}"

    return None
