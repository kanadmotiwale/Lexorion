import base64
import json
import time

import jwt

import auth

SECRET = "test-jwt-secret-test-jwt-secret-1234"


def _token(secret=SECRET, sub="user-1", exp_delta=60, aud="authenticated", alg="HS256"):
    payload = {"sub": sub, "aud": aud, "exp": int(time.time()) + exp_delta}
    return jwt.encode(payload, secret, algorithm=alg)


def test_valid_token_returns_sub():
    assert auth.get_user_id(f"Bearer {_token()}", None) == "user-1"


def test_wrong_secret_is_rejected():
    forged = _token(secret="y" * 40, sub="victim")
    assert auth.get_user_id(f"Bearer {forged}", None) is None


def test_unsigned_alg_none_token_is_rejected():
    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': 'victim', 'aud': 'authenticated'})}."
    assert auth.get_user_id(f"Bearer {unsigned}", None) is None


def test_expired_token_is_rejected():
    assert auth.get_user_id(f"Bearer {_token(exp_delta=-10)}", None) is None


def test_wrong_audience_is_rejected():
    assert auth.get_user_id(f"Bearer {_token(aud='someone-else')}", None) is None


def test_garbage_token_is_rejected():
    assert auth.get_user_id("Bearer not.a.jwt", None) is None


def test_invalid_token_falls_back_to_guest_header():
    forged = _token(secret="y" * 40)
    assert auth.get_user_id(f"Bearer {forged}", "abc-123") == "guest_abc-123"


def test_guest_header_only():
    assert auth.get_user_id(None, "abc-123") == "guest_abc-123"


def test_guest_id_is_sanitised():
    assert auth.get_user_id(None, "ab'; DROP TABLE--") == "guest_abDROPTABLE--"


def test_guest_id_is_length_capped():
    assert len(auth.get_user_id(None, "a" * 500)) == len("guest_") + 64


def test_no_credentials_returns_none():
    assert auth.get_user_id(None, None) is None
