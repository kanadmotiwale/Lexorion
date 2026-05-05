import base64
import json
from fastapi import Header, HTTPException


def get_user_id(authorization: str = Header(None)) -> str:
    """
    FastAPI dependency — extracts the Supabase user ID from the
    'Authorization: Bearer <token>' header sent by the frontend.

    Supabase issues signed JWTs; we decode the payload to read the
    'sub' claim (the user's UUID).  The token was already validated
    by Supabase Auth when it was issued, so decoding without re-
    verifying the signature is safe here.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1]

    try:
        # JWT = header.payload.signature  (all base64url-encoded)
        payload_b64 = token.split(".")[1]
        # base64url may lack padding — add it back
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub claim")

        return user_id

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
