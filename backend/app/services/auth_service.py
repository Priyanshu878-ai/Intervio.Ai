import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import generate_auth_token, hash_password, verify_password
from app.db.models.candidate import Candidate
from app.db.models.auth_token import AuthToken
from app.schemas.auth import LoginRequest, RegisterRequest


def register_candidate(db: Session, req: RegisterRequest) -> Tuple[Candidate, str]:
    normalized_email = req.email.lower().strip()
    existing = db.execute(
        select(Candidate).where(Candidate.email == normalized_email)
    ).scalar_one_or_none()

    if existing:
        raise ValueError("A candidate with this email is already registered")

    hashed = hash_password(req.password)
    candidate = Candidate(
        name=req.name.strip(),
        email=normalized_email,
        hashed_password=hashed,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    # Issue initial token
    token_str = generate_auth_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    auth_token = AuthToken(
        token=token_str,
        candidate_id=candidate.id,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(auth_token)
    db.commit()

    return candidate, token_str


def authenticate_candidate(db: Session, req: LoginRequest) -> Tuple[Candidate, str]:
    normalized_email = req.email.lower().strip()
    candidate = db.execute(
        select(Candidate).where(Candidate.email == normalized_email)
    ).scalar_one_or_none()

    if not candidate or not candidate.hashed_password:
        raise ValueError("Invalid email or password")

    if not verify_password(req.password, candidate.hashed_password):
        raise ValueError("Invalid email or password")

    # Issue new active token
    token_str = generate_auth_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    auth_token = AuthToken(
        token=token_str,
        candidate_id=candidate.id,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(auth_token)
    db.commit()

    return candidate, token_str


def get_candidate_by_token(db: Session, token_str: str) -> Optional[Candidate]:
    now = datetime.now(timezone.utc)
    auth_token = db.execute(
        select(AuthToken).where(
            AuthToken.token == token_str,
            AuthToken.is_revoked == False,
            AuthToken.expires_at > now,
        )
    ).scalar_one_or_none()

    if not auth_token:
        return None

    return auth_token.candidate


def revoke_token(db: Session, token_str: str) -> bool:
    auth_token = db.execute(
        select(AuthToken).where(AuthToken.token == token_str)
    ).scalar_one_or_none()

    if auth_token:
        auth_token.is_revoked = True
        db.commit()
        return True
    return False
