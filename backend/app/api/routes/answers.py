import os
import tempfile
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.answer import AnswerCreate, AnswerResponse
from app.schemas.evaluation import (
    AnalyzeAnswerRequest,
    AnswerAnalysisResponse,
    AudioAnalysisResponse,
    VisionAnalysisResponse,
)
from app.services import answer_service

router = APIRouter(prefix="/questions", tags=["Answers"])


@router.post("/{question_id}/answer", response_model=AnswerResponse, status_code=status.HTTP_201_CREATED)
def create_answer(question_id: uuid.UUID, answer_in: AnswerCreate, db: Session = Depends(get_db)):
    try:
        return answer_service.create_answer(db, question_id, answer_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{question_id}/answer", response_model=AnswerResponse)
def get_answer(question_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        answer = answer_service.get_answer_by_question_id(db, question_id)
        if not answer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found for this question")
        return answer
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.post("/{question_id}/analyze", response_model=AnswerAnalysisResponse, status_code=status.HTTP_201_CREATED)
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


@router.post("/{question_id}/analyze-audio", response_model=AudioAnalysisResponse, status_code=status.HTTP_200_OK)
def analyze_question_audio(
    question_id: uuid.UUID,
    file: UploadFile = File(...),
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


@router.post("/{question_id}/analyze-video", response_model=VisionAnalysisResponse, status_code=status.HTTP_200_OK)
def analyze_question_video(
    question_id: uuid.UUID,
    file: UploadFile = File(...),
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


