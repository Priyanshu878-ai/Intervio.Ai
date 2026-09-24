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
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


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
