from fastapi import APIRouter
from app.api.routes import answers, candidates, interviews, questions

api_router = APIRouter(prefix="/api")
api_router.include_router(candidates.router)
api_router.include_router(interviews.router)
api_router.include_router(questions.router)
api_router.include_router(answers.router)
