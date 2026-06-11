from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Jjigeukka API",
    description="FastAPI backend for the Jjigeukka project.",
    version="0.1.0",
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router)


@app.get("/")
def read_root():
    return {"message": "Jjigeukka API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
