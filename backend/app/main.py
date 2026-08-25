import logging
import re
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.db.session import engine
from app.routers.missions import router as missions_router
from app.routers.schedules import (
    invitations_router,
    schedule_invitations_router,
    schedule_missions_router,
    schedules_router,
)
from app.routers.mission_sessions import router as mission_sessions_router
from app.routers.magazines import router as magazines_router
from app.services.mission_session_timeouts import restore_pending_timeouts

settings = get_settings()
logger = logging.getLogger("app.requests")
LOG_DIR = Path("logs")
REQUEST_LOG_FILE = LOG_DIR / "backend.log"
SENSITIVE_QUERY_PATTERN = re.compile(
    r"([?&](?:token|access_token)=)[^&\s\"]+",
    flags=re.IGNORECASE,
)


def _redact_sensitive_query(value):
    if isinstance(value, str):
        return SENSITIVE_QUERY_PATTERN.sub(r"\1[REDACTED]", value)
    if isinstance(value, tuple):
        return tuple(_redact_sensitive_query(item) for item in value)
    if isinstance(value, dict):
        return {key: _redact_sensitive_query(item) for key, item in value.items()}
    return value


class SensitiveQueryFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = _redact_sensitive_query(record.msg)
        record.args = _redact_sensitive_query(record.args)
        return True

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
LOG_DIR.mkdir(exist_ok=True)

sensitive_query_filter = SensitiveQueryFilter()
for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
    logging.getLogger(logger_name).addFilter(sensitive_query_filter)
for handler in logging.getLogger().handlers:
    handler.addFilter(sensitive_query_filter)

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
            "description": "Email registration, verification, login, and password reset.",
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
        {"name": "mission sessions", "description": "Authenticated team mission execution and photo sharing APIs."},
        {
            "name": "magazines",
            "description": "Magazine-ready data assembled from completed schedule missions.",
        },
    ],
)


@app.exception_handler(SQLAlchemyTimeoutError)
async def database_pool_timeout_handler(
    request: Request,
    _error: SQLAlchemyTimeoutError,
) -> JSONResponse:
    """Return a bounded overload response without exposing database details."""
    logger.error(
        "database pool exhausted method=%s path=%s pool_status=%s",
        request.method,
        request.url.path,
        engine.pool.status(),
    )
    return JSONResponse(
        status_code=503,
        content={
            "detail": {
                "code": "DATABASE_BUSY",
                "message": "The server is temporarily busy. Please retry shortly.",
            }
        },
        headers={"Retry-After": "1"},
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
app.include_router(mission_sessions_router)
app.include_router(magazines_router)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.on_event("startup")
async def restore_mission_session_deadlines():
    restore_pending_timeouts()


@app.get("/")
def read_root():
    return {"message": "Jjigeukka API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
