import os
import tempfile
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

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



@router.post(
    "/{question_id}/answer",
    response_model=AnswerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Answer Record",
    description="Creates an initial answer record for a question.",
)
def create_answer(question_id: uuid.UUID, answer_in: AnswerCreate, db: Session = Depends(get_db)):
    try:
        return answer_service.create_answer(db, question_id, answer_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get(
    "/{question_id}/answer",
    response_model=AnswerResponse,
    summary="Get Answer by Question ID",
    description="Retrieves the submitted answer record for a specific question.",
)
def get_answer(question_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        answer = answer_service.get_answer_by_question_id(db, question_id)
        if not answer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found for this question")
        return answer
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{question_id}/analyze",
    response_model=AnswerAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Analyze Text Answer",
    description="Evaluates a written answer using deterministic and Transformer-based semantic similarity against the question prompt.",
)
def analyze_question_answer(
    question_id: uuid.UUID,
    req: AnalyzeAnswerRequest,
    db: Session = Depends(get_db),
):
    try:
        return answer_service.analyze_and_save_answer_evaluation(
            db=db,
            question_id=question_id,
            answer_text=req.answer_text,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{question_id}/analyze-audio",
    response_model=AudioAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Audio Response",
    description="Evaluates speech acoustics, duration, pause patterns, speaking rate (WPM), and filler words from an audio recording (.wav).",
)
def analyze_question_audio(
    question_id: uuid.UUID,
    file: UploadFile = File(..., description="Audio file (.wav) to analyze"),
    db: Session = Depends(get_db),
):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            return answer_service.analyze_audio_file(
                db=db,
                question_id=question_id,
                audio_file_path=tmp_path,
            )
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{question_id}/analyze-video",
    response_model=VisionAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Video Response",
    description="Evaluates video frames for visual presence, gaze engagement approximations, and facial landmark stability (.mp4).",
)
def analyze_question_video(
    question_id: uuid.UUID,
    file: UploadFile = File(..., description="Video file (.mp4) to analyze"),
    db: Session = Depends(get_db),
):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            return answer_service.analyze_video_file(
                db=db,
                question_id=question_id,
                video_file_path=tmp_path,
            )
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post(
    "/{question_id}/analyze-multimodal",
    response_model=MultimodalAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Multimodal Answer (Fusion)",
    description="Performs fused evaluation combining text, audio, and vision modalities with dynamic weight normalization.",
)
def analyze_question_multimodal(
    question_id: uuid.UUID,
    answer_text: Optional[str] = Form(None, description="Answer text or transcript"),
    audio_file: Optional[UploadFile] = File(None, description="Optional audio file (.wav)"),
    video_file: Optional[UploadFile] = File(None, description="Optional video file (.mp4)"),
    db: Session = Depends(get_db),
):
    try:
        audio_tmp_path = None
        video_tmp_path = None

        if audio_file and audio_file.filename:
            suffix = os.path.splitext(audio_file.filename)[1] or ".wav"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_audio:
                tmp_audio.write(audio_file.file.read())
                audio_tmp_path = tmp_audio.name

        if video_file and video_file.filename:
            suffix = os.path.splitext(video_file.filename)[1] or ".mp4"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_video:
                tmp_video.write(video_file.file.read())
                video_tmp_path = tmp_video.name

        try:
            return answer_service.analyze_multimodal_answer(
                db=db,
                question_id=question_id,
                answer_text=answer_text,
                audio_file_path=audio_tmp_path,
                video_file_path=video_tmp_path,
            )
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
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))



