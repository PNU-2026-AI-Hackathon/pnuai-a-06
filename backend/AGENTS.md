# Backend Agent Notes

## Environment

- Work from `/home/malcolm/pnuai-a-06/backend`.
- Python environment is conda env `pnuai`.
- Install dependencies with `pip install -r requirements.txt` inside that env.
- Run migrations with `alembic upgrade head`.
- Run API externally on port 7020 with `uvicorn app.main:app --host 0.0.0.0 --port 7020 --reload`.
- API docs should be checked at `http://<server-host>:7020/docs`.
- Default database URL is `postgresql+psycopg://postgres:postgres@localhost:5432/jjigeukka`.
- If `alembic upgrade head` fails with `connection refused`, PostgreSQL is not listening on `localhost:5432`.
- Local dev DB uses installed PostgreSQL binaries and workspace `.pgdata`:
  `test -d .pgdata || /usr/lib/postgresql/15/bin/initdb -D .pgdata -U postgres --auth=trust`
  `/usr/lib/postgresql/15/bin/pg_ctl -D .pgdata -l logs/postgres.log -o "-p 5432 -k /tmp" start`
  `createdb -h 127.0.0.1 -p 5432 -U postgres jjigeukka`

## Current Product Direction

- Sprint focus is a single-user flow: login -> home -> map -> basket mission list/detail -> add mission to basket.
- Companion-room features are intentionally deferred.
- Busan is split into three basket themes: `MOUNTAIN`, `SEA`, `CITY`.
- Important domain rule: `MOUNTAIN`, `SEA`, and `CITY` are basket/theme categories, not Busan districts. Never add `district_code` or `district_label` to `mission_sets`/basket theme responses.
- District data belongs to individual `missions` only.
- Sprint 2 mission data is DB-seeded as 12 missions: each theme has 2 basic, 1 rare, and 1 side mission.
- Mission responses include `district_code` and `district_label`; basket/theme responses must not include district tags.
- Current district codes are provisional per mission and can be edited later: `BUSANJIN`, `GEUMJEONG`, `GIJANG`, `HAEUNDAE`, `JUNG`, `NAM`, `SUYEONG`.
- The primary mission browsing API is `GET /missions`, filterable by `district_code`, `theme`, and `type`.
- `GET /districts` supports the first district-based browsing screen.
- `GET /mission-sets` and `GET /mission-sets/{id}` are basket/theme-oriented APIs.
- Mission photos are expected to be filled manually later in `app/static/mission-photos/`.
- Mission seed data points `target_photo_url` to `/missions/{MISSION_CODE}/photo`.
- The photo API reads files from `app/static/mission-photos/{MISSION_CODE}.jpg`.
- `target_photo_id` is the mission code, for example `SEA_B01`.
- Keep `target_photo_id` and `target_photo_url` nullable because some local/dev DBs may not have images yet.
- Basic mission photos currently exist and return `200 image/jpeg`: `MTN_B01`, `MTN_B02`, `SEA_B01`, `SEA_B02`, `CITY_B01`, `CITY_B02`.

## Current Mission Data

Mission district tags are provisional placeholders and should be changed when the team decides exact locations:

```text
MTN_B01  MOUNTAIN  BASIC  이제 부산은 제 겁니다              NAM        남구
MTN_B02  MOUNTAIN  BASIC  템플스테이                        GEUMJEONG  금정구
MTN_R01  MOUNTAIN  RARE   피톤치드 힐링                     GIJANG     기장군
MTN_S01  MOUNTAIN  SIDE   주모 한 잔 추가요                 GEUMJEONG  금정구
SEA_B01  SEA       BASIC  서핑 좋아하세요?                  HAEUNDAE   해운대구
SEA_B02  SEA       BASIC  둘이서 떠나요                     SUYEONG    수영구
SEA_R01  SEA       RARE   바다에 왔으면 옷이 젖어야 하는 법 HAEUNDAE   해운대구
SEA_S01  SEA       SIDE   와사비 폭탄                       JUNG       중구
CITY_B01 CITY      BASIC  카멜레온 게임                     JUNG       중구
CITY_B02 CITY      BASIC  사이버펑크 부산                   HAEUNDAE   해운대구
CITY_R01 CITY      RARE   서울숲 아니고 부산숲              BUSANJIN   부산진구
CITY_S01 CITY      SIDE   물떡 빼빼로 게임                  JUNG       중구
```

## Code Organization

- Keep new feature code layer-based:
  - routers in `app/routers/`
  - SQLAlchemy models in `app/models/`
  - Pydantic schemas in `app/schemas/`
  - service/query logic in `app/services/`
- Do not add new feature routers inside domain folders such as `app/missions/router.py`.

## Mission API

- Public reads:
  - `GET /districts`: list Busan districts that currently have missions, with mission counts.
  - `GET /missions`: primary mission list; filter with `district_code`, `theme`, and/or `type`.
  - `GET /missions/{mission_code}/photo`: returns the mission photo as `image/jpeg`; 404 if file is missing.
  - `GET /mission-sets`
  - `GET /mission-sets/{mission_set_id}`
- Authenticated user state:
  - `GET /baskets/me`
  - `POST /cart-items` with `{ "mission_id": 1 }`
  - `GET /cart-items/me`
- `POST /cart-items` creates a cart item if it does not already exist and moves the matching theme basket from `EMPTY` to `FILLED`.
- `cart_items` currently means selected/added mission, not final mission completion.
- Mission completion/submission judging is not implemented yet. Add a separate submission API when photo upload/completion rules are decided.

## Swagger Auth

- Swagger Authorize uses OAuth2 password flow and posts form data to `POST /auth/token`.
- In Swagger, put email in `username`, password in `password`, and leave `client_id`/`client_secret` empty.
- App/frontend JSON login remains `POST /auth/email/login`.
- There may be no users initially. Register with `POST /auth/email/register`, use `dev_verification_code`, then verify with `POST /auth/email/verify`.

## Mission Photo Filenames

Place files here:

```text
app/static/mission-photos/
```

Expected filenames:

```text
MTN_B01.jpg
MTN_B02.jpg
MTN_R01.jpg
MTN_S01.jpg
SEA_B01.jpg
SEA_B02.jpg
SEA_R01.jpg
SEA_S01.jpg
CITY_B01.jpg
CITY_B02.jpg
CITY_R01.jpg
CITY_S01.jpg
```
