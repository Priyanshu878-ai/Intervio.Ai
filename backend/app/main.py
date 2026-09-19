from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

tags_metadata = [
    {
        "name": "Interviews",
        "description": "Interview session orchestration, question generation, adaptive flow, and final report analytics.",
    },
    {
        "name": "Answers",
        "description": "Candidate answer submissions and modality-specific / multimodal evaluations.",
    },
    {
        "name": "Questions",
        "description": "Interview question bank management.",
    },
    {
        "name": "Candidates",
        "description": "Candidate profile management.",
    },
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    openapi_tags=tags_metadata,
)

# Enable CORS for frontend applications (e.g. Next.js, Vite/React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register combined API router under /api
app.include_router(api_router)


@app.get("/")
def read_root():
    return {"message": "Welcome to Intervio.Ai API"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Intervio.Ai Backend",
    }
