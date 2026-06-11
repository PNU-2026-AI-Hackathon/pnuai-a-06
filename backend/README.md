# Backend

FastAPI backend for the Jjigeukka project.

## Setup

```bash
conda activate pnuai
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your PostgreSQL and Kakao values.

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DB_NAME
KAKAO_REST_API_KEY=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret-if-enabled
KAKAO_REDIRECT_URI=http://localhost:8000/auth/kakao/callback
JWT_SECRET_KEY=replace-this-with-a-long-random-secret
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

## Kakao Login

Register this redirect URI in Kakao Developers during local development:

```text
http://localhost:8000/auth/kakao/callback
```

Login flow:

```text
GET /auth/kakao/login
GET /auth/kakao/callback
```

The callback creates or updates a user by `provider="kakao"` and Kakao `provider_user_id`, then returns a service JWT.
