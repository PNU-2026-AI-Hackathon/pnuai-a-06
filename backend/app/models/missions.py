from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MissionSet(Base):
    __tablename__ = "mission_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    theme: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    region_label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    missions: Mapped[list["Mission"]] = relationship(
        back_populates="mission_set",
        cascade="all, delete-orphan",
    )
    translations: Mapped[list["MissionSetTranslation"]] = relationship(
        back_populates="mission_set",
        cascade="all, delete-orphan",
    )


class MissionSetTranslation(Base):
    __tablename__ = "mission_set_translations"
    __table_args__ = (
        UniqueConstraint(
            "mission_set_id",
            "locale",
            name="uq_mission_set_translations_set_locale",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mission_set_id: Mapped[int] = mapped_column(
        ForeignKey("mission_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    locale: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    mission_set: Mapped[MissionSet] = relationship(back_populates="translations")


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mission_set_id: Mapped[int] = mapped_column(
        ForeignKey("mission_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    theme: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    district_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    district_label: Mapped[str] = mapped_column(String(100), nullable=False)
    place_label: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unlock_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_keyword: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_photo_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    emoji_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    judgement_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reward_item_name: Mapped[str] = mapped_column(String(100), nullable=False)
    reward_item_icon: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    mission_set: Mapped[MissionSet] = relationship(back_populates="missions")
    locations: Mapped[list["MissionLocation"]] = relationship(
        back_populates="mission",
        cascade="all, delete-orphan",
        order_by="MissionLocation.id",
    )
    translations: Mapped[list["MissionTranslation"]] = relationship(
        back_populates="mission",
        cascade="all, delete-orphan",
    )


class MissionTranslation(Base):
    __tablename__ = "mission_translations"
    __table_args__ = (
        UniqueConstraint(
            "mission_id",
            "locale",
            name="uq_mission_translations_mission_locale",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mission_id: Mapped[int] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    locale: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unlock_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    place_label: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    target_keyword: Mapped[str | None] = mapped_column(String(100), nullable=True)
    judgement_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reward_item_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    mission: Mapped[Mission] = relationship(back_populates="translations")


class MissionLocation(Base):
    __tablename__ = "mission_locations"
    __table_args__ = (
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_mission_locations_latitude",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_mission_locations_longitude",
        ),
        CheckConstraint(
            "allowed_radius_m > 0",
            name="ck_mission_locations_allowed_radius",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mission_id: Mapped[int] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str | None] = mapped_column(String(150), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    allowed_radius_m: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=300,
        server_default="300",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    mission: Mapped[Mission] = relationship(back_populates="locations")
    translations: Mapped[list["MissionLocationTranslation"]] = relationship(
        back_populates="location",
        cascade="all, delete-orphan",
    )


class MissionLocationTranslation(Base):
    __tablename__ = "mission_location_translations"
    __table_args__ = (
        UniqueConstraint(
            "mission_location_id",
            "locale",
            name="uq_mission_location_translations_location_locale",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mission_location_id: Mapped[int] = mapped_column(
        ForeignKey("mission_locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    locale: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    location: Mapped[MissionLocation] = relationship(back_populates="translations")


class MissionDeveloperLocation(Base):
    __tablename__ = "mission_developer_locations"
    __table_args__ = (
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_mission_developer_locations_latitude",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_mission_developer_locations_longitude",
        ),
        CheckConstraint(
            "allowed_radius_m > 0",
            name="ck_mission_developer_locations_allowed_radius",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    allowed_radius_m: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=300,
        server_default="300",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
