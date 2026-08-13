from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.missions import Mission, MissionSet
from app.schemas.missions import MissionType, Theme


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
    stmt = select(Mission).options(selectinload(Mission.locations))
    if district_code:
        stmt = stmt.where(Mission.district_code == district_code)
    if theme:
        stmt = stmt.where(Mission.theme == theme.value)
    if mission_type:
        stmt = stmt.where(Mission.type == mission_type.value)
    stmt = stmt.order_by(Mission.district_code, Mission.theme, Mission.sort_order, Mission.id)
    return list(db.scalars(stmt).all())


def get_mission_by_code(db: Session, mission_code: str) -> Mission | None:
    stmt = (
        select(Mission)
        .where(Mission.code == mission_code)
        .options(selectinload(Mission.locations))
    )
    return db.scalar(stmt)


def get_mission_set(db: Session, mission_set_id: int) -> MissionSet | None:
    stmt = (
        select(MissionSet)
        .where(MissionSet.id == mission_set_id)
        .options(
            selectinload(MissionSet.missions).selectinload(Mission.locations)
        )
    )
    mission_set = db.scalar(stmt)
    if mission_set is not None:
        mission_set.missions.sort(key=lambda mission: (mission.sort_order, mission.id))
    return mission_set
