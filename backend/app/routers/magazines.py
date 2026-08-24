from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.users import User
from app.schemas.magazines import (
    GeneratedMagazineResponse,
    MagazineCandidatesResponse,
    MagazineGenerateRequest,
    MagazineMissionCandidateResponse,
    MagazineTemplateResponse,
    ScheduleMagazineResponse,
)
from app.services.magazine_renderer import MagazineRenderError, load_templates
from app.services.magazines import (
    InvalidMagazineSelection,
    MagazineSelectionRequired,
    build_magazine_candidates,
    build_schedule_magazine,
    generate_schedule_magazine,
    get_generated_magazine,
)
from app.core.localization import resolve_locale


router = APIRouter(tags=["magazines"])


@router.get(
    "/magazine-templates",
    response_model=list[MagazineTemplateResponse],
    summary="List available magazine frames",
)
def list_magazine_templates(
    locale: str = Depends(resolve_locale),
) -> list[MagazineTemplateResponse]:
    return [
        MagazineTemplateResponse(
            key=template.key,
            name=template.name_for(locale),
            version=template.version,
            width=template.width,
            height=template.height,
            output_width=template.output_width,
            output_height=template.output_height,
            mission_capacity_per_image=template.capacity,
        )
        for template in load_templates().values()
    ]


@router.get(
    "/schedules/{schedule_id}/magazine/candidates",
    response_model=MagazineCandidatesResponse,
    summary="List completed missions available for a magazine frame",
)
def read_schedule_magazine_candidates(
    schedule_id: int,
    template_key: str = Query(default="handwriting-2025-v1"),
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MagazineCandidatesResponse:
    template = load_templates().get(template_key)
    if template is None:
        raise HTTPException(status_code=404, detail="Magazine template not found.")
    result = build_magazine_candidates(
        db,
        schedule_id=schedule_id,
        user_id=current_user.id,
        template=template,
        locale=locale,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Mission schedule not found.")
    _, candidates = result
    return MagazineCandidatesResponse(
        schedule_id=schedule_id,
        template_key=template.key,
        locale=locale,
        max_selectable=template.capacity,
        selection_required=len(candidates) > template.capacity,
        candidates=[MagazineMissionCandidateResponse(**candidate) for candidate in candidates],
    )


@router.get(
    "/schedules/{schedule_id}/magazine/draft",
    response_model=ScheduleMagazineResponse,
    summary="Preview the source data used to generate a magazine",
)
def read_schedule_magazine_draft(
    schedule_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMagazineResponse:
    magazine = build_schedule_magazine(
        db, schedule_id=schedule_id, user_id=current_user.id, locale=locale
    )
    if magazine is None:
        raise HTTPException(status_code=404, detail="Mission schedule not found.")
    return magazine


@router.post(
    "/schedules/{schedule_id}/magazine",
    response_model=GeneratedMagazineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate and locally store a schedule magazine image",
    responses={
        404: {"description": "Schedule or template was not found."},
        409: {"description": "There is no renderable completed mission photo."},
    },
)
def create_schedule_magazine(
    schedule_id: int,
    payload: MagazineGenerateRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedMagazineResponse:
    template = load_templates().get(payload.template_key)
    if template is None:
        raise HTTPException(status_code=404, detail="Magazine template not found.")
    try:
        magazine = generate_schedule_magazine(
            db,
            schedule_id=schedule_id,
            user_id=current_user.id,
            template=template,
            locale=locale,
            force=payload.force,
            schedule_mission_ids=payload.schedule_mission_ids,
        )
    except MagazineSelectionRequired as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "MAGAZINE_MISSION_SELECTION_REQUIRED",
                "message": str(exc),
                "max_selectable": exc.max_selectable,
                "candidate_schedule_mission_ids": exc.candidate_ids,
            },
        ) from exc
    except InvalidMagazineSelection as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MagazineRenderError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if magazine is None:
        raise HTTPException(status_code=404, detail="Mission schedule not found.")
    return GeneratedMagazineResponse.model_validate(magazine)


@router.get(
    "/schedules/{schedule_id}/magazine",
    response_model=GeneratedMagazineResponse,
    summary="Get the latest generated magazine for a frame",
)
def read_generated_schedule_magazine(
    schedule_id: int,
    template_key: str = Query(default="handwriting-2025-v1"),
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedMagazineResponse:
    magazine = get_generated_magazine(
        db,
        schedule_id=schedule_id,
        user_id=current_user.id,
        template_key=template_key,
        locale=locale,
    )
    if magazine is None:
        raise HTTPException(status_code=404, detail="Generated magazine not found.")
    return GeneratedMagazineResponse.model_validate(magazine)
