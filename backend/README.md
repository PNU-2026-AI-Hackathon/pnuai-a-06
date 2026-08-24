# Backend

FastAPI backend for the Jjigeukka project.

## Setup

```bash
conda activate pnuai
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your PostgreSQL, JWT, and email values. SMTP is optional during local development. If SMTP is not configured, the register API returns `dev_verification_code` in the response.

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET_KEY=replace-this-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
EMAIL_VERIFICATION_EXPIRE_MINUTES=10
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=no-reply@example.com
SMTP_USE_TLS=true
```

## Database

Create the PostgreSQL database first, then run migrations:

Using the installed PostgreSQL binaries for local development:

```bash
test -d .pgdata || /usr/lib/postgresql/15/bin/initdb -D .pgdata -U postgres --auth=trust
/usr/lib/postgresql/15/bin/pg_ctl -D .pgdata -l logs/postgres.log -o "-p 5432 -k /tmp" start
createdb -h 127.0.0.1 -p 5432 -U postgres jjigeukka
```

If using the system PostgreSQL service instead:

```bash
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb jjigeukka
```

Then run:

```bash
alembic upgrade head
```

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 7020 --reload
```

Open http://127.0.0.1:7020/docs locally, or `http://<server-host>:7020/docs` externally, to view the API docs.

## Email Login

Signup and verification flow:

```text
POST /auth/email/register
POST /auth/email/verify
POST /auth/email/login
POST /auth/email/password-reset/request
POST /auth/email/password-reset/confirm
POST /auth/token/refresh
GET /auth/me
DELETE /auth/me
```

`POST /auth/email/register` accepts `email`, `password`, and `name`, creates a 6-digit verification code, and sends it by SMTP when configured. `POST /auth/email/verify` verifies the code and returns `access_token` and `refresh_token`. `POST /auth/email/login` returns the same token pair after the email is verified. `POST /auth/token/refresh` accepts `refresh_token` and returns a new token pair.

Password reset is a two-step flow. `POST /auth/email/password-reset/request`
accepts `{ "email": "user@example.com" }`. Verified email accounts receive a
six-digit code; when SMTP is disabled locally, the response contains
`dev_verification_code`. An unknown email returns `404 EMAIL_NOT_REGISTERED`, and
an unverified signup returns `409 EMAIL_NOT_VERIFIED`.

`POST /auth/email/password-reset/confirm` accepts:

```json
{
  "email": "user@example.com",
  "code": "123456",
  "new_password": "new-password"
}
```

The code expires after `EMAIL_VERIFICATION_EXPIRE_MINUTES`, is single-use, and is
invalidated after five incorrect attempts. After success, log in through
`POST /auth/email/login` with the new password.

`DELETE /auth/me` permanently deletes the authenticated service account. For a
Kakao account, the backend first calls Kakao's unlink API and deletes the local
account only after unlink succeeds. Configure `KAKAO_ADMIN_KEY` with the Admin
key from the Kakao Developers app. If it is missing or Kakao rejects the unlink
request, the endpoint returns an error and keeps the local account.

Kakao login code is still in the backend, but its route decorators are commented out while email login is active.

## Mission APIs

### Korean and English responses

The endpoint paths stay the same. Add `lang=en` to any localized content request,
or send `Accept-Language: en`. The query parameter wins when both are present.
Korean remains the default and any untranslated field falls back to its Korean value.

```text
GET /missions?lang=en
GET /missions?district_code=HAEUNDAE&lang=en
GET /mission-sets/2?lang=en
GET /schedules/1?lang=en
GET /schedules/1/magazine/draft?lang=en
WS  /mission-sessions/10/ws?token=...&lang=en
```

Localized responses include `Content-Language`. Schedule titles, participant names,
and comments are user-created content and are returned exactly as entered.

English mission, basket, and GPS labels can be edited in the local admin at
`http://<server-host>:8197/translations`.

### Date-specific mission order recommendation

The schedule creator can ask the backend to reorder only one planned day:

```text
POST /schedules/{schedule_id}/days/{planned_date}/recommend-order
Authorization: Bearer <access-token>
```

Use an ISO date such as `2026-08-24`. The request has no JSON body. The backend
sends that day's mission place names, detailed addresses, and configured GPS
coordinates to OpenAI, validates that every scheduled mission id appears exactly
once, and persists the returned one-based `visit_order`. Missions assigned to
other dates are not changed. Schedule mission arrays are returned in
`planned_date`, then `visit_order` order.

The endpoint returns `409` when the date has no missions, `502` when a valid
recommendation cannot be generated, and `503` when `OPENAI_API_KEY` is missing.

Current mission APIs are split by purpose:

```text
GET /districts
```

Returns district groups from mission data. Use this for the first screen where users browse missions by Busan district.

```text
GET /missions
```

Returns backend-created missions. This is the main mission listing API. It supports district, basket theme, and mission type filters.

Examples:

```text
GET /missions?district_code=HAEUNDAE
GET /missions?theme=SEA
GET /missions?district_code=YEONGDO&theme=SEA
GET /missions?type=SIDE
```

Each mission includes `target_photo_url`. The frontend can use that URL as an image source.

```text
GET /missions/{mission_code}/photo
```

Returns the actual mission photo file. Example: `GET /missions/MTN_B01/photo`.

```text
GET /mission-sets
```

Returns the three regular basket themes (mountain, sea, and city) and the separate `DEMO` category. Use `DEMO` only for presentation missions; it can also be queried with `GET /missions?theme=DEMO`.
Basket themes do not have district tags. District filtering belongs to `GET /missions`.

```text
GET /mission-sets/{mission_set_id}
```

Returns one basket with its missions. Use this for a basket detail screen after the user chooses mountain/sea/city. Includes mission title, type, district, description, reward item, and `target_photo_url`.

Current district codes:

```text
BUSANJIN  부산진구
GEUMJEONG 금정구
GIJANG    기장군
HAEUNDAE  해운대구
JUNG      중구
NAM       남구
SUYEONG   수영구
```

```text
GET /baskets/me
```

Returns the logged-in user's basket visual states. It creates empty basket rows for the user if they do not exist yet.

```text
POST /cart-items
```

Adds a mission to the logged-in user's basket. This is the "담기" action, not mission completion.

```text
GET /cart-items/me
```

Returns missions the logged-in user has selected.

Mission completion/submission judging is not implemented yet. Add a separate submission API when photo upload and completion rules are decided.
