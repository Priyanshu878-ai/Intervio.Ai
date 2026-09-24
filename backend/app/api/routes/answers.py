import os
import uuid
from typing import Optional, Tuple
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_candidate
from app.core.upload_security import (
    ALLOWED_AUDIO_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    MAX_AUDIO_BYTES,
    MAX_VIDEO_BYTES,
    validate_and_save_upload,
    validate_answer_text,
)
from app.db.models.answer import Answer
from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.db.models.question import Question
from app.db.session import get_db
from app.schemas.answer import AnswerCreate, AnswerResponse
from app.schemas.evaluation import (
    AnalyzeAnswerRequest,
    AnswerAnalysisResponse,
    AudioAnalysisResponse,
    MultimodalAnalysisResponse,
    VisionAnalysisResponse,
)
from app.services import answer_service

router = APIRouter(prefix="/questions", tags=["Answers"])


def _verify_question_ownership(
    db: Session, question_id: uuid.UUID, candidate_id: uuid.UUID
) -> Tuple[Question, Interview]:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Question not found"
        )
    interview = db.execute(
        select(Interview).where(Interview.id == question.interview_id)
    ).scalar_one_or_none()
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found"
        )
    if interview.candidate_id != candidate_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: you do not have permission to access this question",
        )
    return question, interview


def _sanitize_answer_response(answer: Answer) -> AnswerResponse:
    """Masks internal server filesystem paths to prevent directory disclosure."""
    return AnswerResponse(
        id=answer.id,
        question_id=answer.question_id,
        answer_text=answer.answer_text,
        audio_path=os.path.basename(answer.audio_path) if answer.audio_path else None,
        video_path=os.path.basename(answer.video_path) if answer.video_path else None,
        duration_seconds=answer.duration_seconds,
        created_at=answer.created_at,
    )


@router.post(
    "/{question_id}/answer",
    response_model=AnswerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Answer Record",
    description="Creates an initial answer record for an authenticated candidate's question.",
)
def create_answer(
    question_id: uuid.UUID,
    answer_in: AnswerCreate,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _, interview = _verify_question_ownership(db, question_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed. No further answers can be submitted.",
        )
    try:
        ans = answer_service.create_answer(db, question_id, answer_in)
        return _sanitize_answer_response(ans)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get(
    "/{question_id}/answer",
    response_model=AnswerResponse,
    summary="Get Answer by Question ID",
    description="Retrieves the submitted answer record for an authenticated candidate's question.",
)
def get_answer(
    question_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _verify_question_ownership(db, question_id, current_candidate.id)
    try:
        answer = answer_service.get_answer_by_question_id(db, question_id)
        if not answer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Answer not found for this question",
            )
        return _sanitize_answer_response(answer)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{question_id}/analyze",
    response_model=AnswerAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Analyze Text Answer",
    description="Evaluates a written answer for an authenticated candidate's interview question.",
)
def analyze_question_answer(
    question_id: uuid.UUID,
    req: AnalyzeAnswerRequest,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _, interview = _verify_question_ownership(db, question_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed.",
        )
    sanitized_text = validate_answer_text(req.answer_text) or ""
    try:
        return answer_service.analyze_and_save_answer_evaluation(
            db=db,
            question_id=question_id,
            answer_text=sanitized_text,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{question_id}/analyze-audio",
    response_model=AudioAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Audio Response",
    description="Evaluates speech acoustics for an authenticated candidate's interview question.",
)
def analyze_question_audio(
    question_id: uuid.UUID,
    file: UploadFile = File(..., description="Audio file (.wav, .webm, etc.) to analyze"),
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _, interview = _verify_question_ownership(db, question_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed.",
        )
    tmp_path = validate_and_save_upload(
        file, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_BYTES, ".wav"
    )
    if not tmp_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file payload is required.",
        )
    try:
        return answer_service.analyze_audio_file(
            db=db,
            question_id=question_id,
            audio_file_path=tmp_path,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@router.post(
    "/{question_id}/analyze-video",
    response_model=VisionAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Video Response",
    description="Evaluates video frames for an authenticated candidate's interview question.",
)
def analyze_question_video(
    question_id: uuid.UUID,
    file: UploadFile = File(..., description="Video file (.mp4, .webm, etc.) to analyze"),
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _, interview = _verify_question_ownership(db, question_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed.",
        )
    tmp_path = validate_and_save_upload(
        file, ALLOWED_VIDEO_EXTENSIONS, MAX_VIDEO_BYTES, ".mp4"
    )
    if not tmp_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Video file payload is required.",
        )
    try:
        return answer_service.analyze_video_file(
            db=db,
            question_id=question_id,
            video_file_path=tmp_path,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@router.post(
    "/{question_id}/analyze-multimodal",
    response_model=MultimodalAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Multimodal Answer (Fusion)",
    description="Performs multimodal fusion evaluation for an authenticated candidate's interview question.",
)
def analyze_question_multimodal(
    question_id: uuid.UUID,
    answer_text: Optional[str] = Form(None, description="Answer text or transcript"),
    audio_file: Optional[UploadFile] = File(None, description="Optional audio file (.wav, .webm)"),
    video_file: Optional[UploadFile] = File(None, description="Optional video file (.mp4, .webm)"),
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _, interview = _verify_question_ownership(db, question_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed.",
        )
    sanitized_text = validate_answer_text(answer_text)
    audio_tmp_path = validate_and_save_upload(
        audio_file, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_BYTES, ".wav"
    )
    video_tmp_path = validate_and_save_upload(
        video_file, ALLOWED_VIDEO_EXTENSIONS, MAX_VIDEO_BYTES, ".mp4"
    )
    try:
        return answer_service.analyze_multimodal_answer(
            db=db,
            question_id=question_id,
            answer_text=sanitized_text,
            audio_file_path=audio_tmp_path,
            video_file_path=video_tmp_path,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    finally:
        if audio_tmp_path and os.path.exists(audio_tmp_path):
            try:
                os.remove(audio_tmp_path)
            except Exception:
                pass
        if video_tmp_path and os.path.exists(video_tmp_path):
            try:
                os.remove(video_tmp_path)
            except Exception:
                pass
