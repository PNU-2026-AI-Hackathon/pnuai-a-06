from fastapi import FastAPI
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
