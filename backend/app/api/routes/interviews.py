import os
import tempfile
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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
from app.db.models.candidate import Candidate
from app.db.session import get_db
from app.schemas.interview import InterviewCreate, InterviewResponse
from app.schemas.question import (
    GenerateQuestionsRequest,
    NextQuestionRequest,
    NextQuestionResponse,
    QuestionResponse,
)
from app.schemas.report import FinalInterviewReport
from app.schemas.session import InterviewSessionResponse, SubmitAnswerResponse
from app.services import interview_service, question_service
from app.services.interview_orchestrator import interview_orchestrator
from app.services.interview_report import interview_report_service

router = APIRouter(prefix="/interviews", tags=["Interviews"])


def _verify_interview_ownership(
    db: Session, interview_id: uuid.UUID, candidate_id: uuid.UUID
):
    interview = interview_service.get_interview_by_id(db, interview_id)
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found"
        )
    if interview.candidate_id != candidate_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: you do not have permission to access this interview",
        )
    return interview


@router.post(
    "",
    response_model=InterviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Interview",
    description="Creates a new interview session record associated with a candidate.",
)
def create_interview(
    interview_in: InterviewCreate,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    if interview_in.candidate_id != current_candidate.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: cannot create interview for another candidate",
        )
    try:
        return interview_service.create_interview(db, interview_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.get(
    "/{interview_id}",
    response_model=InterviewResponse,
    summary="Get Interview Details",
    description="Retrieves configuration and metadata for a specific interview.",
)
def get_interview(
    interview_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    return _verify_interview_ownership(db, interview_id, current_candidate.id)


@router.post(
    "/{interview_id}/generate-questions",
    response_model=List[QuestionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Generate Question Bank",
    description="Generates an initial batch of questions tailored to the candidate's target role and difficulty level.",
)
def generate_questions(
    interview_id: uuid.UUID,
    req: Optional[GenerateQuestionsRequest] = None,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    interview = _verify_interview_ownership(db, interview_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate questions for a completed interview",
        )
    count = req.number_of_questions if (req and req.number_of_questions is not None) else 1
    try:
        return question_service.generate_and_save_questions(
            db=db,
            interview_id=interview_id,
            number_of_questions=count,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post(
    "/{interview_id}/next-question",
    response_model=NextQuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Adaptive Next Question",
    description="Selects and generates the next question adaptively based on the candidate's previous performance level (weak, average, strong).",
)
def get_next_adaptive_question(
    interview_id: uuid.UUID,
    req: NextQuestionRequest,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    interview = _verify_interview_ownership(db, interview_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate next question for a completed interview",
        )
    try:
        return question_service.generate_adaptive_next_question(
            db=db,
            interview_id=interview_id,
            performance_level=req.performance_level,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post(
    "/{interview_id}/start",
    response_model=InterviewSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Interview Session",
    description="Transitions interview status to 'in_progress', records started_at timestamp, and returns initial session state with the first question.",
)
def start_interview_session(
    interview_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    interview = _verify_interview_ownership(db, interview_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed and cannot be restarted",
        )
    try:
        return interview_orchestrator.start_interview(db=db, interview_id=interview_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{interview_id}/session",
    response_model=InterviewSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Session State",
    description="Retrieves current progress, total/answered/remaining question counts, and active question awaiting response.",
)
def get_interview_session(
    interview_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _verify_interview_ownership(db, interview_id, current_candidate.id)
    try:
        return interview_orchestrator.get_session_state(db=db, interview_id=interview_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{interview_id}/submit-answer",
    response_model=SubmitAnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Answer (Multimodal Orchestrated)",
    description="Submits an answer (text, audio, or video), executes multimodal evaluation, upserts records, determines next adaptive strategy, and updates session state.",
)
def submit_interview_answer(
    interview_id: uuid.UUID,
    question_id: uuid.UUID = Form(..., description="UUID of the question being answered"),
    answer_text: Optional[str] = Form(None, description="Candidate written or transcribed answer text"),
    audio_file: Optional[UploadFile] = File(None, description="Optional audio file (.wav) for speech analysis"),
    video_file: Optional[UploadFile] = File(None, description="Optional video file (.mp4) for visual engagement analysis"),
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    interview = _verify_interview_ownership(db, interview_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed. No further answers can be submitted.",
        )

    sanitized_text = validate_answer_text(answer_text)
    audio_tmp_path = validate_and_save_upload(
        audio_file, ALLOWED_AUDIO_EXTENSIONS, MAX_AUDIO_BYTES, ".wav"
    )
    video_tmp_path = validate_and_save_upload(
        video_file, ALLOWED_VIDEO_EXTENSIONS, MAX_VIDEO_BYTES, ".mp4"
    )

    try:
        return interview_orchestrator.submit_answer(
            db=db,
            interview_id=interview_id,
            question_id=question_id,
            answer_text=sanitized_text,
            audio_file_path=audio_tmp_path,
            video_file_path=video_tmp_path,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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


@router.get(
    "/{interview_id}/report",
    response_model=FinalInterviewReport,
    status_code=status.HTTP_200_OK,
    summary="Get Final Interview Report & Analytics",
    description="Calculates and returns the complete final interview report, including overall/technical/text metrics, non-zero modality handling, question analytics, progression curves, and deterministic summary.",
)
def get_interview_report(
    interview_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _verify_interview_ownership(db, interview_id, current_candidate.id)
    try:
        return interview_report_service.generate_report(db=db, interview_id=interview_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


