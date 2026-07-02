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
POST /auth/token/refresh
GET /auth/me
```

`POST /auth/email/register` accepts `email`, `password`, and `name`, creates a 6-digit verification code, and sends it by SMTP when configured. `POST /auth/email/verify` verifies the code and returns `access_token` and `refresh_token`. `POST /auth/email/login` returns the same token pair after the email is verified. `POST /auth/token/refresh` accepts `refresh_token` and returns a new token pair.

Kakao login code is still in the backend, but its route decorators are commented out while email login is active.

## Mission APIs

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

Returns the three backend-created basket themes: mountain, sea, and city. Use this for home/map basket cards.
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
