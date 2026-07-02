from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.missions import (
    BasketResponse,
    CartItemCreateRequest,
    CartItemResponse,
    DistrictResponse,
    MissionResponse,
    MissionType,
    MissionSetDetailResponse,
    MissionSetResponse,
    Theme,
)
from app.services.missions import (
    add_cart_item,
    get_mission_by_code,
    get_mission_set,
    get_or_create_user_baskets,
    list_districts,
    list_mission_sets,
    list_missions,
    list_user_cart_items,
)
from app.models.users import User

router = APIRouter(tags=["missions"])
MISSION_PHOTO_DIR = Path("app/static/mission-photos")


@router.get(
    "/districts",
    response_model=list[DistrictResponse],
    summary="List districts that have missions",
    description=(
        "Returns district groups based on mission data. Use this for the first screen "
        "where users choose a Busan district and see how many missions are available. "
        "This is independent from basket/theme grouping. District counts are based "
        "on each mission's own district tag."
    ),
)
def read_districts(db: Session = Depends(get_db)) -> list[DistrictResponse]:
    return list_districts(db)


@router.get(
    "/missions",
    response_model=list[MissionResponse],
    summary="List missions by district and theme",
    description=(
        "Returns backend-created missions. This is the main read API for the frontend "
        "when users browse missions by Busan district first. It can also filter by "
        "basket theme and mission type. Filters can be combined, for example "
        "`/missions?district_code=HAEUNDAE&theme=SEA`."
    ),
)
def read_missions(
    district_code: str | None = Query(
        default=None,
        description="Optional Busan district filter. Examples: HAEUNDAE, JUNG, GEUMJEONG.",
    ),
    theme: Theme | None = Query(
        default=None,
        description="Optional basket theme filter: MOUNTAIN, SEA, or CITY.",
    ),
    type: MissionType | None = Query(
        default=None,
        description="Optional mission type filter: BASIC, RARE, or SIDE.",
    ),
    db: Session = Depends(get_db),
) -> list[MissionResponse]:
    return list_missions(db, district_code=district_code, theme=theme, mission_type=type)


@router.get(
    "/missions/{mission_code}/photo",
    response_class=FileResponse,
    summary="Get mission target photo",
    description=(
        "Returns the image file for one mission. The frontend can use this endpoint "
        "directly as an image src. Mission photos are stored manually in "
        "`app/static/mission-photos/{MISSION_CODE}.jpg`."
    ),
    responses={
        404: {
            "description": "Mission code was not found, or the image file has not been added yet."
        }
    },
)
def read_mission_photo(
    mission_code: str,
    db: Session = Depends(get_db),
) -> FileResponse:
    mission = get_mission_by_code(db, mission_code)
    if mission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found.",
        )

    photo_path = MISSION_PHOTO_DIR / f"{mission.code}.jpg"
    if not photo_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission photo file not found.",
        )

    return FileResponse(photo_path, media_type="image/jpeg", filename=photo_path.name)


@router.get(
    "/mission-sets",
    response_model=list[MissionSetResponse],
    summary="List basket themes",
    description=(
        "Returns the three backend-created basket themes: mountain, sea, and city. "
        "Use this for home/map basket cards. This endpoint does not require login "
        "and does not include individual missions. Basket themes do not have district "
        "tags; district filtering belongs to `/missions`."
    ),
)
def read_mission_sets(db: Session = Depends(get_db)) -> list[MissionSetResponse]:
    return list_mission_sets(db)


@router.get(
    "/mission-sets/{mission_set_id}",
    response_model=MissionSetDetailResponse,
    summary="Get missions in one basket",
    description=(
        "Returns one basket theme with its missions. Use this when the frontend opens "
        "a basket detail screen. The response includes mission code, type "
        "(BASIC/RARE/SIDE), district code/label, title, description, reward item, and target photo URL. "
        "This endpoint only serves mission content; it does not say whether a user "
        "has selected or completed the mission."
    ),
    responses={404: {"description": "Mission set was not found."}},
)
def read_mission_set(
    mission_set_id: int,
    db: Session = Depends(get_db),
) -> MissionSetDetailResponse:
    mission_set = get_mission_set(db, mission_set_id)
    if mission_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission set not found.",
        )
    return mission_set


@router.get(
    "/baskets/me",
    response_model=list[BasketResponse],
    summary="Get my basket states",
    description=(
        "Returns the logged-in user's basket state for each theme. If the user has "
        "no basket rows yet, this endpoint creates EMPTY baskets for MOUNTAIN, SEA, "
        "and CITY. This is for progress display such as empty/filled basket UI. "
        "It does not judge mission completion."
    ),
)
def read_my_baskets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BasketResponse]:
    return get_or_create_user_baskets(db, current_user.id)


@router.post(
    "/cart-items",
    response_model=CartItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a mission to my basket",
    description=(
        "Stores that the logged-in user selected a mission. This is the current "
        "'basket 담기' action. If the same mission was already selected, the existing "
        "cart item is returned. The matching theme basket moves from EMPTY to FILLED. "
        "This endpoint is not mission completion/submission judging."
    ),
    responses={404: {"description": "Mission was not found."}},
)
def create_cart_item(
    payload: CartItemCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CartItemResponse:
    cart_item = add_cart_item(
        db,
        user_id=current_user.id,
        mission_id=payload.mission_id,
    )
    if cart_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found.",
        )
    return cart_item


@router.get(
    "/cart-items/me",
    response_model=list[CartItemResponse],
    summary="List my selected missions",
    description=(
        "Returns missions the logged-in user has added to their basket. Use this for "
        "a 'selected missions' or 'my basket contents' screen. Status currently means "
        "selection workflow state, not verified mission completion."
    ),
)
def read_my_cart_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CartItemResponse]:
    return list_user_cart_items(db, current_user.id)
