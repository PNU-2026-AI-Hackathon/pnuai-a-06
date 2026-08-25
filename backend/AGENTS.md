# Backend Agent Notes

## Environment

- Work from `/home/malcolm/pnuai-a-06/backend`.
- Python environment is conda env `pnuai`.
- Install dependencies with `pip install -r requirements.txt` inside that env.
- Run migrations with `alembic upgrade head`.
- Current Alembic head is `20260824_0044`; it includes mission judgement/session state, schedule magazine persistence with a global generation-number sequence, GPS checks for mission participation, global developer test locations, localized mission content with locale-specific magazines, a separate demo mission category with 10 seeded demo missions, compact English mission copy, email-verified password reset state, localized detailed mission addresses with seeded English values, and persisted per-day mission visit ordering.
- Run API externally on port 7020 with `uvicorn app.main:app --host 0.0.0.0 --port 7020 --reload`.
- Current long-running dev server convention is tmux session `backend-7020`:
  `tmux attach -t backend-7020`
  `tmux capture-pane -t backend-7020 -p -S -50`
- API docs should be checked at `http://<server-host>:7020/docs`.
- The local mission administration UI runs separately on port 8197:
  `uvicorn mission_admin.server:app --host 0.0.0.0 --port 8197 --reload`
- Mission creation and existing-mission editing are at `http://<server-host>:8197/`; GPS location management is at `http://<server-host>:8197/locations`; English content management is at `http://<server-host>:8197/translations`; global developer test locations are at `http://<server-host>:8197/developer-locations`. All pages use the same administrator session.
- Default database URL is `postgresql+psycopg://postgres:postgres@localhost:5432/jjigeukka`.
- If `alembic upgrade head` fails with `connection refused`, PostgreSQL is not listening on `localhost:5432`.
- Local dev DB uses installed PostgreSQL binaries and workspace `.pgdata`:
  `test -d .pgdata || /usr/lib/postgresql/15/bin/initdb -D .pgdata -U postgres --auth=trust`
  `/usr/lib/postgresql/15/bin/pg_ctl -D .pgdata -l logs/postgres.log -o "-p 5432 -k /tmp" start`
  `createdb -h 127.0.0.1 -p 5432 -U postgres jjigeukka`
- Request logs are written to stdout and `logs/backend.log` with timestamps, method, path, status, client IP, and duration.
- Uvicorn WebSocket logs redact `token` and `access_token` query values. Never remove the sensitive-query logging filter while WebSocket authentication uses a query parameter.
- Runtime logs are ignored by git through `logs/` and `*.log`.

## Current Product Direction

- Sprint focus now includes authenticated date-range mission schedules.
- Users create schedules, invite other users, and add missions to a selected schedule.
- Schedule creators and invited participants are stored separately.
- Kakao share invitations use backend-generated invite tokens and frontend app/deep links.
- Email-targeted invitations can be listed and accepted inside the app through `GET /invitations/me`.
- Regular Busan content is split into three basket themes: `MOUNTAIN`, `SEA`, `CITY`.
- Presentation-only missions use the separate `DEMO` category and mission set. Store new demo missions there rather than mixing them into the three regular baskets. Demo codes are generated as `DEMO_B01`, `DEMO_R01`, or `DEMO_S01` according to mission type.
- Important domain rule: `MOUNTAIN`, `SEA`, and `CITY` are basket/theme categories, not Busan districts. Never add `district_code` or `district_label` to `mission_sets`/basket theme responses.
- District data belongs to individual `missions` only.
- Sprint 2 mission data is DB-seeded as 12 missions: each theme has 2 basic, 1 rare, and 1 side mission.
- Mission responses include `district_code`, `district_label`, `place_label`, and nullable detailed `address`; basket/theme responses must not include district tags.
- Current district codes include `BUK`, `BUSANJIN`, `DONGNAE`, `GANGSEO`, `GEUMJEONG`, `GIJANG`, `HAEUNDAE`, `JUNG`, `NAM`, `SAHA`, `SEO`, `YEONJE`.
- The primary mission browsing API is `GET /missions`, filterable by `district_code`, `theme`, and `type`.
- `GET /districts` supports the first district-based browsing screen.
- `GET /mission-sets` and `GET /mission-sets/{id}` are basket/theme-oriented APIs.
- Mission photos are expected to be filled manually later in `app/static/mission-photos/`.
- Mission seed data points `target_photo_url` to `/missions/{MISSION_CODE}/photo`.
- The photo API reads files from `app/static/mission-photos/{MISSION_CODE}.jpg`.
- `target_photo_id` is the mission code, for example `SEA_B01`.
- Keep `target_photo_id` and `target_photo_url` nullable because some local/dev DBs may not have images yet.
- Basic mission photos currently exist and return `200 image/jpeg`: `MTN_B01`, `MTN_B02`, `SEA_B01`, `SEA_B02`, `CITY_B01`, `CITY_B02`.
- Mission execution now uses schedule-scoped mission sessions with participant decisions, photo submission, asynchronous visual judgement, comments, likes, voting, and WebSocket updates.
- Missions may have multiple allowed GPS points in `mission_locations`; each point has its own label and allowed radius.
- Completed schedule missions with passed submission photos can be rendered into a server-generated magazine image.

## Localization

- Keep the existing endpoint paths. Localized content APIs accept `?lang=ko|en`; when the query is omitted, `Accept-Language` is used. Korean is the default and fallback language.
- `lang` takes precedence over `Accept-Language`. An unsupported explicit `lang` returns `400` with `UNSUPPORTED_LOCALE`; unsupported header languages fall back to Korean.
- Localized HTTP responses set `Content-Language` and `Vary: Accept-Language`.
- Mission-set, mission, district, mission-location, schedule mission, mission-session, candidate, draft, and generated magazine responses localize backend-owned content. User-created schedule titles, nicknames, and comments are never machine-translated and remain exactly as entered.
- WebSockets use `?lang=en` because they cannot use the HTTP locale dependency. Each connection receives session snapshots and events in its own locale.
- Translations are stored in `mission_set_translations`, `mission_translations`, and `mission_location_translations`. Missing rows or null translated fields fall back independently to the Korean source field.
- Current English seed data covers the 3 regular mission sets, the DEMO mission set, all 33 current missions' user-facing core fields and detailed addresses, all 10 demo missions' structured judgement rules, and all currently registered mission GPS labels. Other missing `judgement_rules` translations can be added through the admin page; until then the Korean structured criteria remain the field-level fallback.
- Manage English values at `http://<server-host>:8197/translations`. New missions can also receive an initial English title, description, place, and detailed address from the mission creation page.

## Current Mission Data

Mission district tags and place labels currently reflect the latest DB seed/update:

```text
MTN_B01   MOUNTAIN  BASIC  이제 부산은 제 겁니다              NAM       남구      황령산 봉수대
MTN_B02   MOUNTAIN  BASIC  템플스테이                        BUSANJIN  부산진구  삼광사
MTN_R01   MOUNTAIN  RARE   피톤치드 힐링                     BUK       북구      백양산
MTN_S01   MOUNTAIN  SIDE   주모 한 잔 추가요                 GEUMJEONG 금정구    금정산성
SEA_B01   SEA       BASIC  서핑 좋아하세요?                  HAEUNDAE  해운대구  송정
SEA_B02   SEA       BASIC  둘이서 떠나요                     SEO       서구      송도
SEA_R01   SEA       RARE   바다에 왔으면 옷이 젖어야 하는 법 SAHA      사하구    다대포 해수욕장
SEA_S01   SEA       SIDE   친구야 선물이야                   JUNG      중구      자갈치시장
CITY_B01  CITY      BASIC  카멜레온 게임                     BUK       북구      구포시장
CITY_B02  CITY      BASIC  사이버펑크 부산                   NAM       남구      부산항대교, 문현금융단지
CITY_R01  CITY      RARE   서울숲 아니고 부산숲              GANGSEO   강서구    을숙도
CITY_S01  CITY      SIDE   물떡 빼빼로 게임                  DONGNAE   동래구    동래시장
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
- Each mission may have structured `judgement_rules`; these are the primary criteria for visual submission judgement.
- Mission responses include `locations`. An empty list means exact GPS points have not been configured yet.

## Mission Session API

- Mission execution is schedule-scoped and only one mission session may be active in a schedule at a time.
- Session lifecycle values are `WAITING`, `READY`, `SHOOTING`, `UPLOADING`, `VOTING`, `REVEALED`, `COMPLETED`, and `CANCELLED`.
- Participation choices are `PARTICIPATE` and `PASS`; participant state is tracked separately for every session member.
- GPS is checked when a user chooses `PARTICIPATE`, before the leader starts and locks the session. The leader's create-session action is the UI-level mission start; `POST /mission-sessions/{session_id}/start` begins shooting after participation choices are complete.
- Location enforcement applies only to missions whose `verification_type` is `GPS_PHOTO`. `PHOTO`, `FREE_PHOTO`, and `PASS` receive `NOT_REQUIRED`.
- A `GPS_PHOTO` mission with no `mission_locations` rows temporarily permits participation with `NOT_CONFIGURED`, so exact coordinates can be populated later without blocking development.
- Configured GPS missions require latitude, longitude, device accuracy, and a timezone-aware measurement timestamp. The backend validates freshness and accuracy, calculates great-circle distance, and accepts any configured point whose radius contains the user.
- Failed location checks keep the member `UNDECIDED` so the client can refresh GPS and retry. Exact participant coordinates are stored internally but omitted from API responses.
- The port-8197 GPS admin page lists every mission and supports adding, editing, and deleting multiple allowed locations. Adding the first location automatically changes that mission's `verification_type` to `GPS_PHOTO`; deleting all locations leaves the type unchanged and therefore returns to the temporary `NOT_CONFIGURED` behavior.
- GPS admin coordinate paste fields use map-app order: longitude first, latitude second.
- Global developer locations are stored separately in `mission_developer_locations` and are never exposed in public mission responses. Every active developer location is accepted by every `GPS_PHOTO` mission in addition to that mission's normal locations. The port-8197 developer-location page supports add, edit, delete, individual activation, and activate/deactivate-all controls. Disable all developer locations after testing.
- Main HTTP endpoints:
  - `GET /schedules/{schedule_id}/missions/{schedule_mission_id}/session`: latest attempt for one scheduled mission.
  - `GET /schedules/{schedule_id}/active-mission-session`: active session for the schedule.
  - `POST /schedules/{schedule_id}/missions/{schedule_mission_id}/sessions`: create an attempt.
  - `GET /mission-sessions/{session_id}`: read session state.
  - `POST /mission-sessions/{session_id}/join`
  - `POST /mission-sessions/{session_id}/participation` with `decision` and, for configured `GPS_PHOTO` participation, `latitude`, `longitude`, `accuracy_m`, and `measured_at`.
  - `POST /mission-sessions/{session_id}/ready`
  - `POST /mission-sessions/{session_id}/start`
  - `POST /mission-sessions/{session_id}/photo`: upload one participant photo as multipart form data.
  - `POST /mission-sessions/{session_id}/reveal`
  - `POST /mission-sessions/{session_id}/complete`
  - `POST /mission-sessions/{session_id}/cancel`: creator-only cancellation; persists `CANCELLED` and broadcasts `session_cancelled` to both session and schedule WebSockets.
  - `POST /mission-sessions/{session_id}/submissions/{submission_id}/comments`
  - `POST /mission-sessions/{session_id}/submissions/{submission_id}/like`
- Real-time endpoints accept the access token as the `token` query parameter:
  - `WS /schedules/{schedule_id}/mission-sessions/ws`
  - `WS /mission-sessions/{session_id}/ws`
- A schedule list screen must not call the per-mission latest-session endpoint for every mission. Read `GET /schedules` once, use `GET /schedules/{schedule_id}/active-mission-session` for the selected schedule, and then receive updates over one WebSocket. Treat a session `404` as an empty state and never retry it in a tight loop.
- WebSocket handlers release their authentication/snapshot DB session before entering the long receive loop. Keep this invariant so idle sockets never reserve pooled DB connections.
- Uploaded photos are stored under `app/static/submissions/<session-id>/<user-id>.jpg` and served through `/static/...`.
- A participant can submit only one photo per session and cannot like their own submission.
- Submission judgement statuses are `PENDING`, `PROCESSING`, `PASSED`, `REJECTED`, `REVIEW`, and `ERROR`.
- Photo upload starts `judge_submission` as a background task. The judge compares the mission target image and submitted image through the OpenAI Responses API, applies the mission's `judgement_rules`, and persists score, reason, model, and timestamp.
- Current automatic pass rule requires the model decision to be `PASS` and the score to meet `MISSION_JUDGEMENT_PASS_SCORE`; all other completed judgements become `REJECTED`.
- Missing OpenAI configuration, target image, submission file, or request failure produces `ERROR` and is broadcast to connected clients.
- Location rejection returns `409` with one of `MISSION_LOCATION_REQUIRED`, `MISSION_LOCATION_TIMESTAMP_INVALID`, `MISSION_LOCATION_STALE`, `MISSION_LOCATION_INACCURATE`, or `MISSION_LOCATION_OUT_OF_RANGE` in `detail.code`.

## Magazine API

- Magazine routes require authentication except `GET /magazine-templates`. Schedule access is limited to the creator and accepted members.
- `GET /magazine-templates`: discover every valid frame under `app/static/frame/*/manifest.json`.
- `GET /schedules/{schedule_id}/magazine/candidates?template_key=handwriting-2025-v1`: list completed missions that have at least one passed photo and report whether frontend selection is required.
- `GET /schedules/{schedule_id}/magazine/draft`: inspect the schedule, participants, completed mission pages, winner data, photos, comments, and summary used as render input.
- `POST /schedules/{schedule_id}/magazine`: generate or reuse a magazine. Request body:

```json
{
  "template_key": "handwriting-2025-v1",
  "force": false,
  "schedule_mission_ids": [1, 2, 3]
}
```

- `GET /schedules/{schedule_id}/magazine?template_key=handwriting-2025-v1`: return the latest generated record and its `image_urls`.
- All magazine endpoints honor `?lang=en`/`Accept-Language`; generated records include `locale`, and Korean and English records coexist for the same schedule/template.
- `handwriting-2025-v1` has six mission slots. When renderable candidates exceed six, the frontend must first call the candidates endpoint and send at most six ordered `schedule_mission_ids`.
- Omitting ids when selection is required returns `409` with `MAGAZINE_MISSION_SELECTION_REQUIRED`, `max_selectable`, and candidate ids. Invalid or excessive selections return `422`.
- Fewer than six selected/renderable missions leave the unused frame slots blank; the output canvas is not cropped.
- Each rendered mission uses the winning passed photo when available, otherwise the first passed photo, plus mission title and description.
- Rendered metadata includes the schedule title, date range, creator and accepted member names, and `#<generation_number>`.
- `generation_number` comes from the server-wide PostgreSQL sequence `magazine_generation_number_seq`, not a per-user or per-schedule count.
- A rendered photo includes all comments when there are at most three. More than three are sampled deterministically using the generation number and submission id. Comment authors are not rendered.
- The frame's comment icon is shown only when the selected photo has at least one comment; it is removed with the empty comment area otherwise.
- Identical source data and template version reuse the current `READY` record unless `force` is true. A real regeneration receives a new global generation number.
- The current renderer accepts only local `/static/...` source photos and writes WebP files to `app/static/magazines/<schedule-id>/<template-key>/<locale>/page-<n>.webp`.
- Generated WebP files are runtime artifacts and are ignored by git. `image_urls` is the storage-facing API contract so local storage can later be replaced by S3.
- Generation requires at least one completed mission with a passed local photo; otherwise it returns `409`.

## Magazine Frames

- Frame layout is data-driven:

```text
app/static/frame/<template-key>/
  frame.svg
  manifest.json
```

- A manifest defines the key, version, canvas dimensions, render scale, capacity, font, accent color, and photo/content/comment/icon slots.
- Adding a valid frame directory automatically exposes it through `GET /magazine-templates`; no new router is needed.
- Increment the manifest `version` whenever a frame or slot layout changes so stale generated images are regenerated.
- The current `handwriting-2025-v1` frame renders a 360 x 2112 SVG at scale 2, producing a 720 x 4224 WebP.
- Rendering uses CairoSVG and Pillow; keep both dependencies installed from `requirements.txt`.
- It requires `app/static/fonts/KyoboHandwriting2025lyb.ttf` (Kyobo Handwriting 2025). Font binaries are intentionally ignored and must be installed on each runtime host because redistribution is restricted.
- See `app/static/frame/README.md` for the frame package and frontend selection contract.

## Schedule API

- `GET /schedules`: list schedules visible to the current user.
- `POST /schedules`: create a date-range schedule.
- `GET /schedules/{schedule_id}`: get schedule detail.
- `PATCH /schedules/{schedule_id}`: update schedule fields.
- `DELETE /schedules/{schedule_id}`: delete a schedule if allowed.
- `POST /schedules/{schedule_id}/days/{planned_date}/recommend-order`: creator-only OpenAI recommendation that reorders and persists only the missions assigned to that date. The date path value uses `YYYY-MM-DD` and the response returns those missions in the saved `visit_order`.
- Schedule mission responses include one-based `visit_order`. Schedule/detail mission arrays are sorted by `planned_date`, then `visit_order`.
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
- Password reset uses `POST /auth/email/password-reset/request` followed by `POST /auth/email/password-reset/confirm`. Only verified email accounts can request a code; unknown accounts receive `EMAIL_NOT_REGISTERED` and must register first.
- Kakao auth redirect/token support is restored:
  - `GET /auth/kakao/login`
  - `GET /auth/kakao/callback`
  - `POST /auth/kakao/token`
- Auth docs are split into `email auth`, `kakao auth`, `auth tokens`, and `account`.

## Environment Variables

- `DATABASE_URL`: SQLAlchemy/PostgreSQL connection URL.
- `DATABASE_POOL_SIZE`: persistent SQLAlchemy connection-pool size; defaults to 10.
- `DATABASE_MAX_OVERFLOW`: temporary connections allowed above the pool size; defaults to 10.
- `DATABASE_POOL_TIMEOUT_SECONDS`: maximum wait for a pooled connection; defaults to 10 seconds.
- `JWT_SECRET_KEY`: JWT signing secret.
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`: Kakao login support.
- `KAKAO_ADMIN_KEY`: server-only Kakao Admin key used to unlink Kakao accounts before `DELETE /auth/me` removes the local account. Never expose it to the frontend.
- `FRONTEND_REDIRECT_URI`: auth callback redirect target.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.
- `OPENAI_API_KEY`: API key used by asynchronous mission photo judgement and date-specific mission-order recommendation.
- `OPENAI_VISION_MODEL`: Responses API vision model; defaults to `gpt-5.4-mini`.
- `OPENAI_VISION_TIMEOUT_SECONDS`: mission judgement request timeout; defaults to 60 seconds.
- `OPENAI_ROUTE_MODEL`: Responses API model for mission-order recommendation; defaults to `gpt-5.4-mini`.
- `OPENAI_ROUTE_TIMEOUT_SECONDS`: mission-order recommendation timeout; defaults to 30 seconds.
- `MISSION_JUDGEMENT_PASS_SCORE`: minimum score for an automatic pass; defaults to 70.
- `MISSION_JUDGEMENT_REVIEW_SCORE`: reserved review threshold configuration; defaults to 50.
- `MISSION_LOCATION_MAX_ACCURACY_M`: worst accepted device-reported GPS accuracy; defaults to 100 meters.
- `MISSION_LOCATION_MAX_AGE_SECONDS`: maximum age of a location measurement; defaults to 120 seconds.
- `MISSION_LOCATION_FUTURE_TOLERANCE_SECONDS`: tolerated client/server clock skew; defaults to 30 seconds.
- `MISSION_ADMIN_PASSWORD`: optional password used by the local mission administration tool.
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
