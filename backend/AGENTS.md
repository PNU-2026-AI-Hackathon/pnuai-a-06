# Backend Agent Notes

## Environment

- Work from `/home/malcolm/pnuai-a-06/backend`.
- Python environment is conda env `pnuai`.
- Install dependencies with `pip install -r requirements.txt` inside that env.
- Run migrations with `alembic upgrade head`.
- Run API externally on port 7020 with `uvicorn app.main:app --host 0.0.0.0 --port 7020 --reload`.
- Current long-running dev server convention is tmux session `backend-7020`:
  `tmux attach -t backend-7020`
  `tmux capture-pane -t backend-7020 -p -S -50`
- API docs should be checked at `http://<server-host>:7020/docs`.
- Default database URL is `postgresql+psycopg://postgres:postgres@localhost:5432/jjigeukka`.
- If `alembic upgrade head` fails with `connection refused`, PostgreSQL is not listening on `localhost:5432`.
- Local dev DB uses installed PostgreSQL binaries and workspace `.pgdata`:
  `test -d .pgdata || /usr/lib/postgresql/15/bin/initdb -D .pgdata -U postgres --auth=trust`
  `/usr/lib/postgresql/15/bin/pg_ctl -D .pgdata -l logs/postgres.log -o "-p 5432 -k /tmp" start`
  `createdb -h 127.0.0.1 -p 5432 -U postgres jjigeukka`
- Request logs are written to stdout and `logs/backend.log` with timestamps, method, path, status, client IP, and duration.
- Runtime logs are ignored by git through `logs/` and `*.log`.

## Current Product Direction

- Sprint focus now includes authenticated date-range mission schedules.
- Users create schedules, invite other users, and add missions to a selected schedule.
- Schedule creators and invited participants are stored separately.
- Kakao share invitations use backend-generated invite tokens and frontend app/deep links.
- Email-targeted invitations can be listed and accepted inside the app through `GET /invitations/me`.
- Busan is split into three basket themes: `MOUNTAIN`, `SEA`, `CITY`.
- Important domain rule: `MOUNTAIN`, `SEA`, and `CITY` are basket/theme categories, not Busan districts. Never add `district_code` or `district_label` to `mission_sets`/basket theme responses.
- District data belongs to individual `missions` only.
- Sprint 2 mission data is DB-seeded as 12 missions: each theme has 2 basic, 1 rare, and 1 side mission.
- Mission responses include `district_code`, `district_label`, and `place_label`; basket/theme responses must not include district tags.
- Current district codes include `BUSANJIN`, `DONGNAE`, `GANGSEO`, `GEUMJEONG`, `GIJANG`, `HAEUNDAE`, `JUNG`, `NAM`, `SAHA`, `YEONJE`.
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

Mission district tags and place labels currently reflect the latest DB seed/update:

```text
MTN_B01   MOUNTAIN  BASIC  이제 부산은 제 겁니다              NAM       남구      황령산 봉수대
MTN_B02   MOUNTAIN  BASIC  템플스테이                        BUSANJIN  부산진구  삼광사
MTN_R01   MOUNTAIN  RARE   피톤치드 힐링                     DONGNAE   동래구    금강공원
MTN_S01   MOUNTAIN  SIDE   주모 한 잔 추가요                 GEUMJEONG 금정구    금정산성
SEA_B01   SEA       BASIC  서핑 좋아하세요?                  HAEUNDAE  해운대구  송정
SEA_B02   SEA       BASIC  둘이서 떠나요                     GIJANG    기장군    일광
SEA_R01   SEA       RARE   바다에 왔으면 옷이 젖어야 하는 법 HAEUNDAE  해운대구  해운대 해수욕장
SEA_S01   SEA       SIDE   와사비 폭탄                       SAHA      사하구    다대포
CITY_B01  CITY      BASIC  카멜레온 게임                     JUNG      중구      국제시장
CITY_B02  CITY      BASIC  사이버펑크 부산                   YEONJE    연제구    부산시청
CITY_R01  CITY      RARE   서울숲 아니고 부산숲              GANGSEO   강서구    을숙도
CITY_S01  CITY      SIDE   물떡 빼빼로 게임                  JUNG      중구      부산역
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
- Authenticated schedule mission state:
  - `GET /schedules/{schedule_id}/baskets`: selected schedule's theme states.
  - `GET /schedules/{schedule_id}/missions`: selected schedule's added missions.
  - `POST /schedules/{schedule_id}/missions` with `{ "mission_id": 1 }`: add a mission to that schedule.
- Legacy user-level baskets/cart-items APIs were removed; mission selection is schedule-scoped.
- Mission completion/submission judging is not implemented yet. Add a separate submission API when photo upload/completion rules are decided.

## Schedule API

- `GET /schedules`: list schedules visible to the current user.
- `POST /schedules`: create a date-range schedule.
- `GET /schedules/{schedule_id}`: get schedule detail.
- `PATCH /schedules/{schedule_id}`: update schedule fields.
- `DELETE /schedules/{schedule_id}`: delete a schedule if allowed.
- Schedule routes are grouped in docs as `schedules`, `schedule missions`, and `schedule invitations`.

## Invitation API

- `POST /schedules/{schedule_id}/invitations`: create an email-targeted invitation.
- `POST /schedules/{schedule_id}/share-invitations`: create a Kakao/share invitation token.
- Share invitation responses use frontend-friendly camelCase:
  `{ "roomId": 1, "roomName": "...", "inviterName": "...", "inviteToken": "...", "inviteUrl": "...", "expiresAt": "..." }`.
- `GET /invitations/me`: list pending email invitations for the current authenticated user.
- `GET /invitations/{invite_token}`: preview a token invitation.
- `POST /invitations/{invite_token}/accept`: accept an invitation.
- `POST /invitations/{invite_token}/decline`: decline an invitation.
- Frontend deep links must parse only the `inviteToken` query value before calling backend invitation APIs.

## Swagger Auth

- Swagger Authorize uses OAuth2 password flow and posts form data to `POST /auth/token`.
- In Swagger, put email in `username`, password in `password`, and leave `client_id`/`client_secret` empty.
- App/frontend JSON login remains `POST /auth/email/login`.
- There may be no users initially. Register with `POST /auth/email/register`, use `dev_verification_code`, then verify with `POST /auth/email/verify`.
- Kakao auth redirect/token support is restored:
  - `GET /auth/kakao/login`
  - `GET /auth/kakao/callback`
  - `POST /auth/kakao/token`
- Auth docs are split into `email auth`, `kakao auth`, `auth tokens`, and `account`.

## Environment Variables

- `DATABASE_URL`: SQLAlchemy/PostgreSQL connection URL.
- `JWT_SECRET_KEY`: JWT signing secret.
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`: Kakao login support.
- `FRONTEND_REDIRECT_URI`: auth callback redirect target.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.
- `SCHEDULE_INVITE_BASE_URL`: frontend app/deep-link base used when creating schedule share invitation URLs.
  - Expo route example: `exp://192.168.x.x:8081/--/trip/invite`
  - Backend appends `?inviteToken=<token>` unless the value contains `{inviteToken}`.
  - Template example: `exp://192.168.x.x:8081/--/trip/invite?inviteToken={inviteToken}`.

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
