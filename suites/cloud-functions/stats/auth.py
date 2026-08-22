"""
Firebase ID token verification for Polymorpha Cloud Functions.
Verifies Bearer tokens on every request. Returns uid or raises ValueError.

Local development:
  Set POLYMORPHA_DEV=true to skip token verification (localhost only).
  Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key file
  for Firebase Storage access.
"""

from __future__ import annotations

import os
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials


_app_initialized = False
_dev_mode = os.environ.get('POLYMORPHA_DEV', '').lower() in ('true', '1', 'yes')


def _ensure_initialized() -> None:
    """Initialize firebase-admin with credentials if available."""
    global _app_initialized
    if _app_initialized:
        return

    cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', '')

    try:
        if cred_path and os.path.isfile(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {
                'storageBucket': 'polymorpha-io.firebasestorage.app',
            })
        else:
            firebase_admin.initialize_app()
        _app_initialized = True
    except ValueError:
        _app_initialized = True  # Already initialized
    except Exception:
        if not _dev_mode:
            raise
        # Dev mode: continue without Firebase Admin


def verify_token(request: Any) -> str:
    """Extract and verify Firebase ID token from Authorization header.

    Returns the verified uid on success, or 'anonymous-user' when:
      - No Authorization header is present
      - Token is missing, expired, invalid, or revoked
      - Firebase Admin SDK is not initialized (dev fallback)

    Only raises ValueError for fatal SDK initialization failures.

    The pipeline (parse/clean/stats) is open to anonymous users;
    Firestore writes are separately gated by Firestore security rules.

    In dev mode (POLYMORPHA_DEV=true), skips verification and returns
    a synthetic uid for local testing.
    """
    if _dev_mode:
        return 'dev-user'

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return 'anonymous-user'

    token = auth_header[7:]
    if not token:
        return 'anonymous-user'

    try:
        _ensure_initialized()
        decoded = firebase_auth.verify_id_token(token)
        return decoded['uid']
    except (
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.InvalidIdTokenError,
        firebase_auth.RevokedIdTokenError,
    ):
        # Treat invalid/expired/revoked tokens as anonymous —
        # the pipeline is open to unauthenticated users.
        return 'anonymous-user'
    except ValueError:
        # Already initialized (race), retry once
        try:
            decoded = firebase_auth.verify_id_token(token)
            return decoded['uid']
        except Exception:
            return 'anonymous-user'
    except Exception as e:
        # Fatal: SDK initialization or network failure
        raise ValueError(
            f'Token verification failed: {type(e).__name__}. '
            'Set GOOGLE_APPLICATION_CREDENTIALS and POLYMORPHA_DEV=true for local dev.'
        )
