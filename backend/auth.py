import os
import jwt
from fastapi import Header, HTTPException

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def get_user_id(authorization: str = Header(None)) -> str:
    """
    FastAPI dependency — extracts and verifies the Supabase user ID from the
    'Authorization: Bearer <token>' header sent by the frontend.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please sign in again")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
