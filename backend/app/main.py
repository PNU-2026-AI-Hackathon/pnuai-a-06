from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.routers.missions import router as missions_router

settings = get_settings()

app = FastAPI(
    title="Jjigeukka API",
    description=(
        "FastAPI backend for the Jjigeukka project. "
        "Mission APIs currently cover mission list delivery, user basket state, "
        "and selected mission cart items. Mission completion/submission judging "
        "will be added separately."
    ),
    version="0.1.0",
    openapi_tags=[
        {
            "name": "auth",
            "description": "Email login, token refresh, and current-user authentication.",
        },
        {
            "name": "missions",
            "description": (
                "Busan basket mission APIs. Public endpoints return backend-created "
                "mission data for the frontend. Authenticated endpoints track each "
                "user's basket and selected missions, not final mission completion."
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
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def read_root():
    return {"message": "Jjigeukka API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
