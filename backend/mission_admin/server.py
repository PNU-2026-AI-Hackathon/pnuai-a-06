from pathlib import Path
import json
import math
import re
import secrets
from hmac import compare_digest

from dotenv import dotenv_values

from fastapi import Cookie, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.missions import (
    Mission,
    MissionDeveloperLocation,
    MissionLocation,
    MissionLocationTranslation,
    MissionSet,
    MissionSetTranslation,
    MissionTranslation,
)


app = FastAPI(title="Mission Admin")
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = Path("app/static/mission-photos")
EMOJI_DIR = Path("app/static/mission-emoji")
INDEX_FILE = BASE_DIR / "index.html"
LOCATIONS_FILE = BASE_DIR / "locations.html"
DEVELOPER_LOCATIONS_FILE = BASE_DIR / "developer_locations.html"
TRANSLATIONS_FILE = BASE_DIR / "translations.html"
SESSION_COOKIE = "mission_admin_session"
ADMIN_PASSWORD = dotenv_values(".env").get("MISSION_ADMIN_PASSWORD") or "admin8197"
ADMIN_SESSIONS: set[str] = set()
BUSAN_DISTRICTS = [
    ("GANGSEO", "강서구"), ("GEUMJEONG", "금정구"), ("GIJANG", "기장군"),
    ("NAM", "남구"), ("DONG", "동구"), ("DONGNAE", "동래구"),
    ("BUSANJIN", "부산진구"), ("BUK", "북구"), ("SASANG", "사상구"),
    ("SAHA", "사하구"), ("SEO", "서구"), ("SUYEONG", "수영구"),
    ("YEONGDO", "영도구"), ("YEONJE", "연제구"), ("JUNG", "중구"),
    ("HAEUNDAE", "해운대구"),
]
MISSION_THEME_PREFIXES = {
    "MOUNTAIN": "MTN",
    "SEA": "SEA",
    "CITY": "CITY",
    "DEMO": "DEMO",
}
MISSION_TYPE_PREFIXES = {"BASIC": "B", "RARE": "R", "SIDE": "S"}


def _authorized(session: str | None) -> bool:
    return bool(session and session in ADMIN_SESSIONS)


def _next_code(db, theme: str, mission_type: str) -> str:
    try:
        theme_prefix = MISSION_THEME_PREFIXES[theme]
        type_prefix = MISSION_TYPE_PREFIXES[mission_type]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="지원하지 않는 미션 카테고리 또는 타입입니다.") from exc
    pattern = re.compile(rf"^{theme_prefix}_{type_prefix}(\d+)$")
    numbers = [
        int(match.group(1))
        for code in db.scalars(select(Mission.code).where(Mission.theme == theme, Mission.type == mission_type))
        if (match := pattern.match(code))
    ]
    return f"{theme_prefix}_{type_prefix}{max(numbers, default=0) + 1:02d}"


def _next_sort_order(db, mission_set_id: int) -> int:
    current = db.scalar(
        select(func.max(Mission.sort_order)).where(Mission.mission_set_id == mission_set_id)
    )
    return (current or 0) + 1


def _require_authorized(session: str | None) -> None:
    if not _authorized(session):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")


def _validated_location_values(
    latitude: float,
    longitude: float,
    allowed_radius_m: int,
) -> tuple[float, float, int]:
    if not math.isfinite(latitude) or not -90 <= latitude <= 90:
        raise HTTPException(status_code=400, detail="위도는 -90 이상 90 이하여야 합니다.")
    if not math.isfinite(longitude) or not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="경도는 -180 이상 180 이하여야 합니다.")
    if not 1 <= allowed_radius_m <= 10_000:
        raise HTTPException(status_code=400, detail="허용 반경은 1m 이상 10,000m 이하여야 합니다.")
    return latitude, longitude, allowed_radius_m


def _location_payload(location: MissionLocation) -> dict:
    return {
        "id": location.id,
        "label": location.label,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "allowed_radius_m": location.allowed_radius_m,
    }


def _developer_location_payload(location: MissionDeveloperLocation) -> dict:
    return {
        "id": location.id,
        "label": location.label,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "allowed_radius_m": location.allowed_radius_m,
        "is_active": location.is_active,
    }


def _translation_locale(locale: str) -> str:
    locale = locale.strip().lower().replace("_", "-").split("-", 1)[0]
    if locale != "en":
        raise HTTPException(status_code=400, detail="현재 관리 가능한 번역 언어는 en입니다.")
    return locale


def _district_label_for(code: str) -> tuple[str, str]:
    normalized = code.strip().upper()
    label = dict(BUSAN_DISTRICTS).get(normalized)
    if label is None:
        raise HTTPException(status_code=400, detail="지원하지 않는 지역 코드입니다.")
    return normalized, label


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(INDEX_FILE)


@app.get("/locations", include_in_schema=False)
def locations_page() -> FileResponse:
    return FileResponse(LOCATIONS_FILE)


@app.get("/developer-locations", include_in_schema=False)
def developer_locations_page() -> FileResponse:
    return FileResponse(DEVELOPER_LOCATIONS_FILE)


@app.get("/translations", include_in_schema=False)
def translations_page() -> FileResponse:
    return FileResponse(TRANSLATIONS_FILE)


@app.post("/api/login")
def login(password: str = Form(...)) -> dict:
    if not compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    token = secrets.token_urlsafe(32)
    ADMIN_SESSIONS.add(token)
    response = {"message": "로그인되었습니다."}
    result = JSONResponse(response)
    result.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 8)
    return result


@app.post("/api/logout")
def logout(session: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> dict:
    if session:
        ADMIN_SESSIONS.discard(session)
    return {"message": "로그아웃되었습니다."}


@app.get("/api/options")
def options(session: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        sets = db.scalars(select(MissionSet).order_by(MissionSet.sort_order, MissionSet.id)).all()
        next_codes = {
            f"{item.theme}:{mission_type}": _next_code(db, item.theme, mission_type)
            for item in sets
            for mission_type in ("BASIC", "RARE", "SIDE")
        }
    return {
        "mission_sets": [
            {
                "id": item.id,
                "theme": item.theme,
                "title": item.title,
                "is_demo": item.theme == "DEMO",
            }
            for item in sets
        ],
        "districts": [{"code": code, "label": label} for code, label in BUSAN_DISTRICTS],
        "next_codes": next_codes,
    }


@app.get("/api/missions")
def list_editable_missions(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        missions = list(
            db.scalars(
                select(Mission).order_by(Mission.theme, Mission.sort_order, Mission.id)
            ).all()
        )
        return {
            "missions": [
                {
                    "id": mission.id,
                    "code": mission.code,
                    "theme": mission.theme,
                    "type": mission.type,
                    "district_code": mission.district_code,
                    "district_label": mission.district_label,
                    "place_label": mission.place_label,
                    "address": mission.address,
                    "title": mission.title,
                    "description": mission.description,
                    "unlock_condition": mission.unlock_condition,
                }
                for mission in missions
            ]
        }


@app.put("/api/missions/{mission_id}")
def update_mission(
    mission_id: int,
    district_code: str = Form(...),
    place_label: str = Form(""),
    address: str = Form(""),
    title: str = Form(...),
    description: str = Form(...),
    unlock_condition: str = Form(""),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    if not title.strip() or not description.strip():
        raise HTTPException(status_code=400, detail="제목과 내용은 필수입니다.")
    district_code, district_label = _district_label_for(district_code)
    with SessionLocal() as db:
        mission = db.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="미션을 찾을 수 없습니다.")
        mission.district_code = district_code
        mission.district_label = district_label
        mission.place_label = place_label.strip() or None
        mission.address = address.strip() or None
        mission.title = title.strip()
        mission.description = description.strip()
        mission.unlock_condition = unlock_condition.strip() or None
        db.commit()
        return {"id": mission.id, "code": mission.code, "message": "미션이 수정되었습니다."}


@app.post("/api/missions")
async def create_mission(
    mission_set_id: int = Form(...),
    code: str = Form(...),
    district_code: str = Form(...),
    district_label: str = Form(...),
    place_label: str = Form(""),
    address: str = Form(""),
    mission_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    title_en: str = Form(""),
    description_en: str = Form(""),
    place_label_en: str = Form(""),
    address_en: str = Form(""),
    unlock_condition: str = Form(""),
    verification_type: str = Form("PHOTO"),
    target_keyword: str = Form(""),
    sort_order: int = Form(0),
    target_photo: UploadFile | None = File(None),
    emoji_file: UploadFile | None = File(None),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    code = code.strip().upper()
    mission_type = mission_type.strip().upper()
    if mission_type not in MISSION_TYPE_PREFIXES:
        raise HTTPException(status_code=400, detail="지원하지 않는 미션 타입입니다.")
    if not title.strip() or not description.strip():
        raise HTTPException(
            status_code=400,
            detail="title and description are required.",
        )
    if target_photo and target_photo.content_type not in ("image/jpeg", "image/jpg"):
        raise HTTPException(status_code=400, detail="Target photo must be JPEG.")
    if emoji_file and emoji_file.content_type not in ("image/png",):
        raise HTTPException(status_code=400, detail="Mission emoji must be PNG.")

    with SessionLocal() as db:
        mission_set = db.get(MissionSet, mission_set_id)
        if mission_set is None:
            raise HTTPException(status_code=404, detail="Mission set not found.")
        code = _next_code(db, mission_set.theme, mission_type)
        sort_order = _next_sort_order(db, mission_set.id)
        if db.scalar(select(Mission).where(Mission.code == code)) is not None:
            raise HTTPException(status_code=409, detail="Mission code already exists.")

        mission = Mission(
            mission_set_id=mission_set.id,
            code=code,
            theme=mission_set.theme,
            district_code=district_code.strip().upper(),
            district_label=district_label.strip(),
            place_label=place_label.strip() or None,
            address=address.strip() or None,
            type=mission_type,
            title=title.strip(),
            description=description.strip(),
            unlock_condition=unlock_condition.strip() or None,
            verification_type="PHOTO",
            target_keyword=None,
            target_photo_id=code,
            target_photo_url=f"/missions/{code}/photo",
            emoji_url=f"/static/mission-emoji/{code}_e.png",
            reward_item_name="",
            reward_item_icon="",
            sort_order=sort_order,
        )
        db.add(mission)
        db.flush()
        if (
            title_en.strip()
            or description_en.strip()
            or place_label_en.strip()
            or address_en.strip()
        ):
            db.add(
                MissionTranslation(
                    mission_id=mission.id,
                    locale="en",
                    title=title_en.strip() or None,
                    description=description_en.strip() or None,
                    place_label=place_label_en.strip() or None,
                    address=address_en.strip() or None,
                )
            )
        db.commit()
        db.refresh(mission)

    if target_photo:
        STATIC_DIR.mkdir(parents=True, exist_ok=True)
        (STATIC_DIR / f"{code}.jpg").write_bytes(await target_photo.read())
    if emoji_file:
        EMOJI_DIR.mkdir(parents=True, exist_ok=True)
        (EMOJI_DIR / f"{code}_e.png").write_bytes(await emoji_file.read())
    return {"id": mission.id, "code": mission.code, "message": "Mission created."}


@app.get("/api/translations")
def list_translations(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        mission_sets = list(
            db.scalars(
                select(MissionSet)
                .options(selectinload(MissionSet.translations))
                .order_by(MissionSet.sort_order, MissionSet.id)
            ).all()
        )
        missions = list(
            db.scalars(
                select(Mission)
                .options(
                    selectinload(Mission.translations),
                    selectinload(Mission.locations).selectinload(
                        MissionLocation.translations
                    ),
                )
                .order_by(Mission.theme, Mission.sort_order, Mission.id)
            ).all()
        )

        def translation_for(items, locale: str):
            return next((item for item in items if item.locale == locale), None)

        return {
            "locale": "en",
            "mission_sets": [
                {
                    "id": item.id,
                    "theme": item.theme,
                    "base": {
                        "title": item.title,
                        "region_label": item.region_label,
                        "description": item.description,
                    },
                    "translation": (
                        {
                            "title": translation.title,
                            "region_label": translation.region_label,
                            "description": translation.description,
                        }
                        if (translation := translation_for(item.translations, "en"))
                        else {}
                    ),
                }
                for item in mission_sets
            ],
            "missions": [
                {
                    "id": item.id,
                    "code": item.code,
                    "theme": item.theme,
                    "base": {
                        "title": item.title,
                        "description": item.description,
                        "unlock_condition": item.unlock_condition,
                        "place_label": item.place_label,
                        "address": item.address,
                        "target_keyword": item.target_keyword,
                        "judgement_rules": item.judgement_rules,
                        "reward_item_name": item.reward_item_name,
                    },
                    "translation": (
                        {
                            "title": translation.title,
                            "description": translation.description,
                            "unlock_condition": translation.unlock_condition,
                            "place_label": translation.place_label,
                            "address": translation.address,
                            "target_keyword": translation.target_keyword,
                            "judgement_rules": translation.judgement_rules,
                            "reward_item_name": translation.reward_item_name,
                        }
                        if (translation := translation_for(item.translations, "en"))
                        else {}
                    ),
                    "locations": [
                        {
                            "id": location.id,
                            "base_label": location.label,
                            "label": location_translation.label
                            if (
                                location_translation := translation_for(
                                    location.translations, "en"
                                )
                            )
                            else None,
                        }
                        for location in item.locations
                    ],
                }
                for item in missions
            ],
        }


@app.put("/api/mission-sets/{mission_set_id}/translations/{locale}")
def upsert_mission_set_translation(
    mission_set_id: int,
    locale: str,
    title: str = Form(""),
    region_label: str = Form(""),
    description: str = Form(""),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    locale = _translation_locale(locale)
    with SessionLocal() as db:
        if db.get(MissionSet, mission_set_id) is None:
            raise HTTPException(status_code=404, detail="미션 세트를 찾을 수 없습니다.")
        translation = db.scalar(
            select(MissionSetTranslation).where(
                MissionSetTranslation.mission_set_id == mission_set_id,
                MissionSetTranslation.locale == locale,
            )
        )
        if translation is None:
            translation = MissionSetTranslation(
                mission_set_id=mission_set_id, locale=locale
            )
            db.add(translation)
        translation.title = title.strip() or None
        translation.region_label = region_label.strip() or None
        translation.description = description.strip() or None
        db.commit()
    return {"message": "미션 세트 영문 번역이 저장되었습니다."}


@app.put("/api/missions/{mission_id}/translations/{locale}")
def upsert_mission_translation(
    mission_id: int,
    locale: str,
    title: str = Form(""),
    description: str = Form(""),
    unlock_condition: str = Form(""),
    place_label: str = Form(""),
    address: str = Form(""),
    target_keyword: str = Form(""),
    reward_item_name: str = Form(""),
    judgement_rules: str = Form(""),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    locale = _translation_locale(locale)
    parsed_rules = None
    if judgement_rules.strip():
        try:
            parsed_rules = json.loads(judgement_rules)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400, detail=f"판정 규칙 JSON이 올바르지 않습니다: {exc.msg}"
            ) from exc
        if not isinstance(parsed_rules, dict):
            raise HTTPException(status_code=400, detail="판정 규칙은 JSON 객체여야 합니다.")
    with SessionLocal() as db:
        if db.get(Mission, mission_id) is None:
            raise HTTPException(status_code=404, detail="미션을 찾을 수 없습니다.")
        translation = db.scalar(
            select(MissionTranslation).where(
                MissionTranslation.mission_id == mission_id,
                MissionTranslation.locale == locale,
            )
        )
        if translation is None:
            translation = MissionTranslation(mission_id=mission_id, locale=locale)
            db.add(translation)
        translation.title = title.strip() or None
        translation.description = description.strip() or None
        translation.unlock_condition = unlock_condition.strip() or None
        translation.place_label = place_label.strip() or None
        translation.address = address.strip() or None
        translation.target_keyword = target_keyword.strip() or None
        translation.reward_item_name = reward_item_name.strip() or None
        translation.judgement_rules = parsed_rules
        db.commit()
    return {"message": "미션 영문 번역이 저장되었습니다."}


@app.put("/api/mission-locations/{location_id}/translations/{locale}")
def upsert_mission_location_translation(
    location_id: int,
    locale: str,
    label: str = Form(""),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    locale = _translation_locale(locale)
    with SessionLocal() as db:
        if db.get(MissionLocation, location_id) is None:
            raise HTTPException(status_code=404, detail="GPS 위치를 찾을 수 없습니다.")
        translation = db.scalar(
            select(MissionLocationTranslation).where(
                MissionLocationTranslation.mission_location_id == location_id,
                MissionLocationTranslation.locale == locale,
            )
        )
        if translation is None:
            translation = MissionLocationTranslation(
                mission_location_id=location_id, locale=locale
            )
            db.add(translation)
        translation.label = label.strip() or None
        db.commit()
    return {"message": "GPS 위치 영문 번역이 저장되었습니다."}


@app.get("/api/location-missions")
def list_location_missions(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        missions = list(
            db.scalars(
                select(Mission)
                .options(selectinload(Mission.locations))
                .order_by(Mission.theme, Mission.sort_order, Mission.id)
            ).all()
        )
        return {
            "missions": [
                {
                    "id": mission.id,
                    "code": mission.code,
                    "title": mission.title,
                    "theme": mission.theme,
                    "type": mission.type,
                    "district_label": mission.district_label,
                    "place_label": mission.place_label,
                    "address": mission.address,
                    "verification_type": mission.verification_type,
                    "locations": [
                        _location_payload(location) for location in mission.locations
                    ],
                }
                for mission in missions
            ]
        }


@app.post("/api/missions/{mission_id}/locations", status_code=201)
def create_mission_location(
    mission_id: int,
    label: str = Form(""),
    latitude: float = Form(...),
    longitude: float = Form(...),
    allowed_radius_m: int = Form(300),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    latitude, longitude, allowed_radius_m = _validated_location_values(
        latitude, longitude, allowed_radius_m
    )
    with SessionLocal() as db:
        mission = db.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="미션을 찾을 수 없습니다.")
        location = MissionLocation(
            mission_id=mission.id,
            label=label.strip() or mission.place_label,
            latitude=latitude,
            longitude=longitude,
            allowed_radius_m=allowed_radius_m,
        )
        mission.verification_type = "GPS_PHOTO"
        db.add(location)
        db.commit()
        db.refresh(location)
        return {
            "message": "GPS 위치가 등록되었습니다.",
            "mission_verification_type": mission.verification_type,
            "location": _location_payload(location),
        }


@app.put("/api/mission-locations/{location_id}")
def update_mission_location(
    location_id: int,
    label: str = Form(""),
    latitude: float = Form(...),
    longitude: float = Form(...),
    allowed_radius_m: int = Form(...),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    latitude, longitude, allowed_radius_m = _validated_location_values(
        latitude, longitude, allowed_radius_m
    )
    with SessionLocal() as db:
        location = db.get(MissionLocation, location_id)
        if location is None:
            raise HTTPException(status_code=404, detail="GPS 위치를 찾을 수 없습니다.")
        location.label = label.strip() or None
        location.latitude = latitude
        location.longitude = longitude
        location.allowed_radius_m = allowed_radius_m
        db.commit()
        db.refresh(location)
        return {
            "message": "GPS 위치가 수정되었습니다.",
            "location": _location_payload(location),
        }


@app.delete("/api/mission-locations/{location_id}")
def delete_mission_location(
    location_id: int,
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        location = db.get(MissionLocation, location_id)
        if location is None:
            raise HTTPException(status_code=404, detail="GPS 위치를 찾을 수 없습니다.")
        db.delete(location)
        db.commit()
    return {"message": "GPS 위치가 삭제되었습니다."}


@app.get("/api/developer-locations")
def list_developer_locations(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        locations = list(
            db.scalars(
                select(MissionDeveloperLocation).order_by(MissionDeveloperLocation.id)
            ).all()
        )
        return {
            "locations": [_developer_location_payload(location) for location in locations],
            "active_count": sum(location.is_active for location in locations),
        }


@app.post("/api/developer-locations", status_code=201)
def create_developer_location(
    label: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    allowed_radius_m: int = Form(300),
    is_active: bool = Form(True),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    latitude, longitude, allowed_radius_m = _validated_location_values(
        latitude, longitude, allowed_radius_m
    )
    if not label.strip():
        raise HTTPException(status_code=400, detail="테스트 장소 이름을 입력하세요.")
    with SessionLocal() as db:
        location = MissionDeveloperLocation(
            label=label.strip(),
            latitude=latitude,
            longitude=longitude,
            allowed_radius_m=allowed_radius_m,
            is_active=is_active,
        )
        db.add(location)
        db.commit()
        db.refresh(location)
        return {
            "message": "전체 미션 테스트 위치가 등록되었습니다.",
            "location": _developer_location_payload(location),
        }


@app.put("/api/developer-locations/{location_id}")
def update_developer_location(
    location_id: int,
    label: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    allowed_radius_m: int = Form(...),
    is_active: bool = Form(True),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    latitude, longitude, allowed_radius_m = _validated_location_values(
        latitude, longitude, allowed_radius_m
    )
    if not label.strip():
        raise HTTPException(status_code=400, detail="테스트 장소 이름을 입력하세요.")
    with SessionLocal() as db:
        location = db.get(MissionDeveloperLocation, location_id)
        if location is None:
            raise HTTPException(status_code=404, detail="테스트 위치를 찾을 수 없습니다.")
        location.label = label.strip()
        location.latitude = latitude
        location.longitude = longitude
        location.allowed_radius_m = allowed_radius_m
        location.is_active = is_active
        db.commit()
        db.refresh(location)
        return {
            "message": "전체 미션 테스트 위치가 수정되었습니다.",
            "location": _developer_location_payload(location),
        }


@app.patch("/api/developer-locations/{location_id}/active")
def set_developer_location_active(
    location_id: int,
    is_active: bool = Form(...),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        location = db.get(MissionDeveloperLocation, location_id)
        if location is None:
            raise HTTPException(status_code=404, detail="테스트 위치를 찾을 수 없습니다.")
        location.is_active = is_active
        db.commit()
        db.refresh(location)
        state = "활성화" if location.is_active else "비활성화"
        return {
            "message": f"테스트 위치가 {state}되었습니다.",
            "location": _developer_location_payload(location),
        }


@app.post("/api/developer-locations/active")
def set_all_developer_locations_active(
    is_active: bool = Form(...),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        locations = list(db.scalars(select(MissionDeveloperLocation)).all())
        for location in locations:
            location.is_active = is_active
        db.commit()
    state = "활성화" if is_active else "비활성화"
    return {"message": f"전체 테스트 위치 {len(locations)}개가 {state}되었습니다."}


@app.delete("/api/developer-locations/{location_id}")
def delete_developer_location(
    location_id: int,
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    _require_authorized(session)
    with SessionLocal() as db:
        location = db.get(MissionDeveloperLocation, location_id)
        if location is None:
            raise HTTPException(status_code=404, detail="테스트 위치를 찾을 수 없습니다.")
        db.delete(location)
        db.commit()
    return {"message": "전체 미션 테스트 위치가 삭제되었습니다."}
