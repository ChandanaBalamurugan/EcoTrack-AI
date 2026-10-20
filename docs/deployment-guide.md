# Deployment guide

Nothing here has been deployed or verified for you. Follow the steps and confirm each check yourself.

## 1. Database (PostgreSQL, persistent)

Render's free web service has an ephemeral disk, so SQLite data would be lost on redeploy. Use managed PostgreSQL.

1. In Render choose **New > PostgreSQL** and create a database.
2. Copy its **Internal Database URL** (or External URL if the web service is elsewhere).
3. You will paste it as `DATABASE_URL`. The app accepts `postgres://` and `postgresql://` forms.

Tables are created automatically on first start (`db.create_all()`). For schema changes later, add Flask-Migrate/Alembic, which is out of scope for this project.

## 2. Backend on Render

1. Push the repository to GitHub (never commit `.env`).
2. In Render choose **New > Web Service**, select the repo, and set **Root Directory** `backend` (or use the included `backend/render.yaml` as a Blueprint).
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app.main:app --bind 0.0.0.0:$PORT` (binds to the port Render provides).
5. Health check path: `/api/health`.
6. Environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL URL from step 1 |
| `CORS_ORIGINS` | Your Vercel URL, e.g. `https://ecotrack-ai.vercel.app` (no trailing slash; comma-separate several) |
| `GEMINI_API_KEY` | Optional. Without it the rule-based engine is used |
| `GEMINI_MODEL` | Optional, default `gemini-2.0-flash` |
| `PYTHON_VERSION` | `3.11.9` |

7. After deploy, open `https://<your-service>.onrender.com/api/health`. You should see `{"status":"ok",...}`.

## 3. Frontend on Vercel

1. In Vercel choose **Add New > Project**, import the repo, set **Root Directory** `frontend`. Framework preset: Vite.
2. Environment variable `VITE_API_URL` = `https://<your-service>.onrender.com/api` (must end with `/api`).
3. Deploy. `vercel.json` rewrites all paths to `index.html` so React Router deep links work.
4. If the browser shows CORS errors, re-check that `CORS_ORIGINS` exactly equals your Vercel origin, then redeploy the backend.

## 4. Verification checklist

* `/api/health` returns ok.
* Home page shows a live sample calculation (proves the API URL and CORS).
* Add an activity, refresh the page, and confirm it persists.
* Restart the backend service and confirm data is still there.

Render free instances sleep when idle, so the first request can take about a minute.
