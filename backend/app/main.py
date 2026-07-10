import logging
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.routers.missions import router as missions_router
from app.routers.schedules import (
    invitations_router,
    schedule_invitations_router,
    schedule_missions_router,
    schedules_router,
)

settings = get_settings()
logger = logging.getLogger("app.requests")
LOG_DIR = Path("logs")
REQUEST_LOG_FILE = LOG_DIR / "backend.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
LOG_DIR.mkdir(exist_ok=True)

if not any(
    isinstance(handler, RotatingFileHandler)
    and getattr(handler, "baseFilename", None) == str(REQUEST_LOG_FILE.resolve())
    for handler in logger.handlers
):
    request_file_handler = RotatingFileHandler(
        REQUEST_LOG_FILE,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    request_file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )
    logger.addHandler(request_file_handler)
    logger.setLevel(logging.INFO)

app = FastAPI(
    title="Jjigeukka API",
    description=(
        "FastAPI backend for the Jjigeukka project. "
        "Mission APIs currently cover mission discovery, date-range schedules, "
        "schedule-based mission selection, and shareable invitations."
    ),
    version="0.1.0",
    openapi_tags=[
        {
            "name": "auth",
            "description": "Authentication support and shared security definitions.",
        },
        {
            "name": "email auth",
            "description": "Email registration, verification, and login.",
        },
        {
            "name": "kakao auth",
            "description": "Kakao SDK access-token login for mobile clients.",
        },
        {
            "name": "auth tokens",
            "description": "OAuth2 Swagger login and refresh-token APIs.",
        },
        {
            "name": "account",
            "description": "Current-user profile, nickname, emoji, and profile image APIs.",
        },
        {
            "name": "missions",
            "description": (
                "Public Busan mission content APIs: districts, missions, photos, "
                "and basket theme mission sets."
            ),
        },
        {
            "name": "schedules",
            "description": (
                "Authenticated APIs for creating, listing, updating, and opening "
                "date-range mission schedules."
            ),
        },
        {
            "name": "schedule missions",
            "description": (
                "Authenticated APIs for missions and theme basket states inside "
                "a selected schedule."
            ),
        },
        {
            "name": "schedule invitations",
            "description": (
                "Authenticated and link-based APIs for email invitations, Kakao "
                "share invitations, and invitation accept/decline."
            ),
        },
    ],
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    client_host = request.client.host if request.client else "-"
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "request failed method=%s path=%s client=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            client_host,
            duration_ms,
        )
        raise

    duration_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        "request method=%s path=%s status=%s client=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        client_host,
        duration_ms,
    )
    return response


app.include_router(auth_router)
app.include_router(missions_router)
app.include_router(schedules_router)
app.include_router(schedule_missions_router)
app.include_router(schedule_invitations_router)
app.include_router(invitations_router)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def read_root():
    return {"message": "Jjigeukka API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
