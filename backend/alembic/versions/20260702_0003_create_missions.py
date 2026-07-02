"""create mission basket tables

Revision ID: 20260702_0003
Revises: 20260616_0002
Create Date: 2026-07-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260702_0003"
down_revision: Union[str, None] = "20260616_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


mission_sets_table = sa.table(
    "mission_sets",
    sa.column("id", sa.Integer),
    sa.column("theme", sa.String),
    sa.column("title", sa.String),
    sa.column("region_label", sa.String),
    sa.column("description", sa.Text),
    sa.column("sort_order", sa.Integer),
)

missions_table = sa.table(
    "missions",
    sa.column("mission_set_id", sa.Integer),
    sa.column("code", sa.String),
    sa.column("theme", sa.String),
    sa.column("type", sa.String),
    sa.column("title", sa.String),
    sa.column("description", sa.Text),
    sa.column("unlock_condition", sa.Text),
    sa.column("verification_type", sa.String),
    sa.column("target_keyword", sa.String),
    sa.column("target_photo_id", sa.String),
    sa.column("target_photo_url", sa.String),
    sa.column("reward_item_name", sa.String),
    sa.column("reward_item_icon", sa.String),
    sa.column("sort_order", sa.Integer),
)


def upgrade() -> None:
    op.create_table(
        "mission_sets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("theme", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("region_label", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("theme"),
    )
    op.create_index(op.f("ix_mission_sets_id"), "mission_sets", ["id"], unique=False)
    op.create_index(op.f("ix_mission_sets_theme"), "mission_sets", ["theme"], unique=False)

    op.create_table(
        "missions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mission_set_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("theme", sa.String(length=30), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("unlock_condition", sa.Text(), nullable=True),
        sa.Column("verification_type", sa.String(length=30), nullable=False),
        sa.Column("target_keyword", sa.String(length=100), nullable=True),
        sa.Column("target_photo_id", sa.String(length=100), nullable=True),
        sa.Column("target_photo_url", sa.String(length=1000), nullable=True),
        sa.Column("reward_item_name", sa.String(length=100), nullable=False),
        sa.Column("reward_item_icon", sa.String(length=20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["mission_set_id"], ["mission_sets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_missions_code"), "missions", ["code"], unique=False)
    op.create_index(op.f("ix_missions_id"), "missions", ["id"], unique=False)
    op.create_index(op.f("ix_missions_mission_set_id"), "missions", ["mission_set_id"], unique=False)
    op.create_index(op.f("ix_missions_theme"), "missions", ["theme"], unique=False)
    op.create_index(op.f("ix_missions_type"), "missions", ["type"], unique=False)

    op.create_table(
        "baskets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("theme", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "theme", name="uq_baskets_user_theme"),
    )
    op.create_index(op.f("ix_baskets_id"), "baskets", ["id"], unique=False)
    op.create_index(op.f("ix_baskets_theme"), "baskets", ["theme"], unique=False)
    op.create_index(op.f("ix_baskets_user_id"), "baskets", ["user_id"], unique=False)

    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "mission_id", name="uq_cart_items_user_mission"),
    )
    op.create_index(op.f("ix_cart_items_id"), "cart_items", ["id"], unique=False)
    op.create_index(op.f("ix_cart_items_mission_id"), "cart_items", ["mission_id"], unique=False)
    op.create_index(op.f("ix_cart_items_user_id"), "cart_items", ["user_id"], unique=False)

    op.bulk_insert(
        mission_sets_table,
        [
            {
                "id": 1,
                "theme": "MOUNTAIN",
                "title": "산 바구니",
                "region_label": "부산 산과 숲",
                "description": "부산의 전망, 사찰, 숲, 노포 감성을 모으는 바구니",
                "sort_order": 1,
            },
            {
                "id": 2,
                "theme": "SEA",
                "title": "바다 바구니",
                "region_label": "부산 바다",
                "description": "부산 바다에서 발견하는 활동, 관계, 해산물 미션",
                "sort_order": 2,
            },
            {
                "id": 3,
                "theme": "CITY",
                "title": "도시 바구니",
                "region_label": "부산 도심",
                "description": "시장, 야경, 공원, 길거리 음식을 즐기는 도시 미션",
                "sort_order": 3,
            },
        ],
    )
    op.bulk_insert(
        missions_table,
        [
            {
                "mission_set_id": 1,
                "code": "MTN_B01",
                "theme": "MOUNTAIN",
                "type": "BASIC",
                "title": "이제 부산은 제 겁니다",
                "description": "산 전망대에서 부산 풍경이 한눈에 내려다 보이게 사진 찍기!",
                "unlock_condition": None,
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "MTN_B01",
                "target_photo_url": "/static/mission-photos/MTN_B01.jpg",
                "reward_item_name": "전망대",
                "reward_item_icon": "🏙️",
                "sort_order": 1,
            },
            {
                "mission_set_id": 1,
                "code": "MTN_B02",
                "theme": "MOUNTAIN",
                "type": "BASIC",
                "title": "템플스테이",
                "description": "절에 등이 빛나는 모습을 포착해보기! 등이 없으면 후레쉬로 이마 비추기",
                "unlock_condition": None,
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "MTN_B02",
                "target_photo_url": "/static/mission-photos/MTN_B02.jpg",
                "reward_item_name": "연등",
                "reward_item_icon": "🏮",
                "sort_order": 2,
            },
            {
                "mission_set_id": 1,
                "code": "MTN_R01",
                "theme": "MOUNTAIN",
                "type": "RARE",
                "title": "피톤치드 힐링",
                "description": "건물이 보이지 않고 오로지 숲 속 풍경만 보이도록 사진 찍기",
                "unlock_condition": "산 바구니 기본 미션 완료 후 해금",
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "MTN_R01",
                "target_photo_url": "/static/mission-photos/MTN_R01.jpg",
                "reward_item_name": "숲",
                "reward_item_icon": "🌲",
                "sort_order": 3,
            },
            {
                "mission_set_id": 1,
                "code": "MTN_S01",
                "theme": "MOUNTAIN",
                "type": "SIDE",
                "title": "주모 한 잔 추가요",
                "description": "이마에 흰색 수건/손수건 두르고 금색 막걸리 잔이 보이게 노포 야장 인증샷!",
                "unlock_condition": None,
                "verification_type": "FREE_PHOTO",
                "target_keyword": None,
                "target_photo_id": "MTN_S01",
                "target_photo_url": "/static/mission-photos/MTN_S01.jpg",
                "reward_item_name": "막걸리 잔",
                "reward_item_icon": "🍶",
                "sort_order": 4,
            },
            {
                "mission_set_id": 2,
                "code": "SEA_B01",
                "theme": "SEA",
                "type": "BASIC",
                "title": "서핑 좋아하세요?",
                "description": "바다에서 서핑하는 사람 발견해서 사진 찍기!",
                "unlock_condition": None,
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "SEA_B01",
                "target_photo_url": "/static/mission-photos/SEA_B01.jpg",
                "reward_item_name": "서핑보드",
                "reward_item_icon": "🏄",
                "sort_order": 1,
            },
            {
                "mission_set_id": 2,
                "code": "SEA_B02",
                "theme": "SEA",
                "type": "BASIC",
                "title": "둘이서 떠나요",
                "description": "바다에서 커플인척 둘이서 손잡고 인증하기!",
                "unlock_condition": None,
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "SEA_B02",
                "target_photo_url": "/static/mission-photos/SEA_B02.jpg",
                "reward_item_name": "손잡기",
                "reward_item_icon": "🤝",
                "sort_order": 2,
            },
            {
                "mission_set_id": 2,
                "code": "SEA_R01",
                "theme": "SEA",
                "type": "RARE",
                "title": "바다에 왔으면 옷이 젖어야 하는 법",
                "description": "바다 입수 후 젖은 신체/옷가지 인증하기!",
                "unlock_condition": "바다 바구니 기본 미션 완료 후 해금",
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "SEA_R01",
                "target_photo_url": "/static/mission-photos/SEA_R01.jpg",
                "reward_item_name": "물방울",
                "reward_item_icon": "💧",
                "sort_order": 3,
            },
            {
                "mission_set_id": 2,
                "code": "SEA_S01",
                "theme": "SEA",
                "type": "SIDE",
                "title": "와사비 폭탄",
                "description": "와사비를 해산물에 숨겨 친구에게 먹인 뒤 일그러진 표정 순간 포착하기!",
                "unlock_condition": None,
                "verification_type": "FREE_PHOTO",
                "target_keyword": None,
                "target_photo_id": "SEA_S01",
                "target_photo_url": "/static/mission-photos/SEA_S01.jpg",
                "reward_item_name": "와사비",
                "reward_item_icon": "🟢",
                "sort_order": 4,
            },
            {
                "mission_set_id": 3,
                "code": "CITY_B01",
                "theme": "CITY",
                "type": "BASIC",
                "title": "카멜레온 게임",
                "description": "시장 파라솔 색과 똑같은 컬러매칭 옷 입고 인증하기!",
                "unlock_condition": None,
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "CITY_B01",
                "target_photo_url": "/static/mission-photos/CITY_B01.jpg",
                "reward_item_name": "시장 파라솔",
                "reward_item_icon": "⛱️",
                "sort_order": 1,
            },
            {
                "mission_set_id": 3,
                "code": "CITY_B02",
                "theme": "CITY",
                "type": "BASIC",
                "title": "사이버펑크 부산",
                "description": "빛나는 고층 빌딩 야경 사진 찍어보기!",
                "unlock_condition": None,
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "CITY_B02",
                "target_photo_url": "/static/mission-photos/CITY_B02.jpg",
                "reward_item_name": "네온 빌딩",
                "reward_item_icon": "🌃",
                "sort_order": 2,
            },
            {
                "mission_set_id": 3,
                "code": "CITY_R01",
                "theme": "CITY",
                "type": "RARE",
                "title": "서울숲 아니고 부산숲",
                "description": "부산이 자랑하는 탁 트인 공원에서 돗자리 깔고 인증샷!",
                "unlock_condition": "도시 바구니 기본 미션 완료 후 해금",
                "verification_type": "PHOTO",
                "target_keyword": None,
                "target_photo_id": "CITY_R01",
                "target_photo_url": "/static/mission-photos/CITY_R01.jpg",
                "reward_item_name": "돗자리",
                "reward_item_icon": "🧺",
                "sort_order": 3,
            },
            {
                "mission_set_id": 3,
                "code": "CITY_S01",
                "theme": "CITY",
                "type": "SIDE",
                "title": "물떡 빼빼로 게임",
                "description": "상대방의 입술을 피해 물떡을 2cm이하로 남기기!",
                "unlock_condition": None,
                "verification_type": "FREE_PHOTO",
                "target_keyword": None,
                "target_photo_id": "CITY_S01",
                "target_photo_url": "/static/mission-photos/CITY_S01.jpg",
                "reward_item_name": "물떡",
                "reward_item_icon": "🍢",
                "sort_order": 4,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_cart_items_user_id"), table_name="cart_items")
    op.drop_index(op.f("ix_cart_items_mission_id"), table_name="cart_items")
    op.drop_index(op.f("ix_cart_items_id"), table_name="cart_items")
    op.drop_table("cart_items")
    op.drop_index(op.f("ix_baskets_user_id"), table_name="baskets")
    op.drop_index(op.f("ix_baskets_theme"), table_name="baskets")
    op.drop_index(op.f("ix_baskets_id"), table_name="baskets")
    op.drop_table("baskets")
    op.drop_index(op.f("ix_missions_type"), table_name="missions")
    op.drop_index(op.f("ix_missions_theme"), table_name="missions")
    op.drop_index(op.f("ix_missions_mission_set_id"), table_name="missions")
    op.drop_index(op.f("ix_missions_id"), table_name="missions")
    op.drop_index(op.f("ix_missions_code"), table_name="missions")
    op.drop_table("missions")
    op.drop_index(op.f("ix_mission_sets_theme"), table_name="mission_sets")
    op.drop_index(op.f("ix_mission_sets_id"), table_name="mission_sets")
    op.drop_table("mission_sets")
