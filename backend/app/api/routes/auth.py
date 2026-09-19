from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_candidate, get_current_token
from app.db.models.candidate import Candidate
from app.db.session import get_db
from app.schemas.auth import LoginRequest, LogoutResponse, RegisterRequest, TokenResponse
from app.schemas.candidate import CandidateResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Candidate",
    description="Registers a new candidate with name, email, and secure hashed password.",
)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    try:
        candidate, token = auth_service.register_candidate(db, req)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            candidate=CandidateResponse.model_validate(candidate),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login",
    description="Authenticates candidate credentials and issues an active access token.",
)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        candidate, token = auth_service.authenticate_candidate(db, req)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            candidate=CandidateResponse.model_validate(candidate),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/me",
    response_model=CandidateResponse,
    status_code=status.HTTP_200_OK,
    summary="Current User Profile",
    description="Returns the authenticated candidate's profile information.",
)
def get_current_user(current_candidate: Candidate = Depends(get_current_candidate)):
    return CandidateResponse.model_validate(current_candidate)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    status_code=status.HTTP_200_OK,
    summary="Logout",
    description="Revokes the current authentication token on the server.",
)
def logout(
    current_candidate: Candidate = Depends(get_current_candidate),
    token: str = Depends(get_current_token),
    db: Session = Depends(get_db),
):
    auth_service.revoke_token(db, token)
    return LogoutResponse(message="Logged out successfully")
