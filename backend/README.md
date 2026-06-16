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

```bash
alembic upgrade head
```

## Run

```bash
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs to view the API docs.

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
