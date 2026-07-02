from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.missions import Basket, CartItem, Mission, MissionSet
from app.schemas.missions import BasketStatus, CartItemStatus, MissionType, Theme


THEMES = [theme.value for theme in Theme]


def list_mission_sets(db: Session) -> list[MissionSet]:
    stmt = select(MissionSet).order_by(MissionSet.sort_order, MissionSet.id)
    return list(db.scalars(stmt).all())


def list_districts(db: Session) -> list[dict[str, str | int]]:
    stmt = (
        select(
            Mission.district_code,
            Mission.district_label,
            func.count(Mission.id).label("mission_count"),
        )
        .group_by(Mission.district_code, Mission.district_label)
        .order_by(Mission.district_code)
    )
    return [
        {
            "district_code": row.district_code,
            "district_label": row.district_label,
            "mission_count": row.mission_count,
        }
        for row in db.execute(stmt).all()
    ]


def list_missions(
    db: Session,
    *,
    district_code: str | None = None,
    theme: Theme | None = None,
    mission_type: MissionType | None = None,
) -> list[Mission]:
    stmt = select(Mission)
    if district_code:
        stmt = stmt.where(Mission.district_code == district_code)
    if theme:
        stmt = stmt.where(Mission.theme == theme.value)
    if mission_type:
        stmt = stmt.where(Mission.type == mission_type.value)
    stmt = stmt.order_by(Mission.district_code, Mission.theme, Mission.sort_order, Mission.id)
    return list(db.scalars(stmt).all())


def get_mission_by_code(db: Session, mission_code: str) -> Mission | None:
    stmt = select(Mission).where(Mission.code == mission_code)
    return db.scalar(stmt)


def get_mission_set(db: Session, mission_set_id: int) -> MissionSet | None:
    stmt = (
        select(MissionSet)
        .where(MissionSet.id == mission_set_id)
        .options(selectinload(MissionSet.missions))
    )
    mission_set = db.scalar(stmt)
    if mission_set is not None:
        mission_set.missions.sort(key=lambda mission: (mission.sort_order, mission.id))
    return mission_set


def get_or_create_user_baskets(db: Session, user_id: int) -> list[Basket]:
    existing = {
        basket.theme: basket
        for basket in db.scalars(select(Basket).where(Basket.user_id == user_id)).all()
    }
    created = False
    for theme in THEMES:
        if theme not in existing:
            basket = Basket(user_id=user_id, theme=theme, status=BasketStatus.EMPTY.value)
            db.add(basket)
            existing[theme] = basket
            created = True
    if created:
        db.commit()

    baskets = [existing[theme] for theme in THEMES]
    for basket in baskets:
        db.refresh(basket)
    return baskets


def add_cart_item(db: Session, *, user_id: int, mission_id: int) -> CartItem | None:
    mission = db.get(Mission, mission_id)
    if mission is None:
        return None

    stmt = (
        select(CartItem)
        .where(CartItem.user_id == user_id, CartItem.mission_id == mission_id)
        .options(selectinload(CartItem.mission))
    )
    cart_item = db.scalar(stmt)
    if cart_item is None:
        cart_item = CartItem(
            user_id=user_id,
            mission_id=mission_id,
            status=CartItemStatus.ADDED.value,
        )
        db.add(cart_item)

    basket_stmt = select(Basket).where(
        Basket.user_id == user_id,
        Basket.theme == mission.theme,
    )
    basket = db.scalar(basket_stmt)
    if basket is None:
        basket = Basket(
            user_id=user_id,
            theme=mission.theme,
            status=BasketStatus.FILLED.value,
        )
        db.add(basket)
    elif basket.status == BasketStatus.EMPTY.value:
        basket.status = BasketStatus.FILLED.value

    db.commit()
    db.refresh(cart_item)
    return db.scalar(
        select(CartItem)
        .where(CartItem.id == cart_item.id)
        .options(selectinload(CartItem.mission))
    )


def list_user_cart_items(db: Session, user_id: int) -> list[CartItem]:
    stmt = (
        select(CartItem)
        .where(CartItem.user_id == user_id)
        .options(selectinload(CartItem.mission))
        .order_by(CartItem.created_at.desc(), CartItem.id.desc())
    )
    return list(db.scalars(stmt).all())
