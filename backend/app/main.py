from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
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
