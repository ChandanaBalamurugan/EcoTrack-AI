# EcoTrack AI - Carbon Footprint Monitoring and Reduction Platform

A full-stack college microproject: React + Vite frontend, Flask + SQLAlchemy backend, SQLite locally and PostgreSQL in production, optional Gemini explanations with a rule-based fallback.

> **Emission factors are illustrative.** See `docs/emission-factors.md`. Replace them with official values before any real reporting.

## 1. Abstract
EcoTrack AI lets individuals and organisations record electricity, transport, fuel and waste activity, converts each record into kg CO2e with a transparent formula, and shows analytics, hotspots, calculated reduction recommendations, a what-if simulator and target tracking.

## 2. Problem statement
Manual carbon accounting is slow, the maths is opaque, the largest sources are hard to see, and people lack practical, quantified ways to cut emissions and compare against targets.

## 3. Objectives
Collect validated activity data; calculate emissions; explain every calculation in 8 steps; show analytics; identify hotspots; recommend reductions using the same factors; simulate alternatives; track progress against targets; export reports.

## 4. Existing system and limitations
Spreadsheets and generic online calculators: no history, no step-by-step transparency, mixed or unstated factor sources, no targets.

## 5. Proposed system
A database-backed web app where every figure traces back to a saved record, a versioned factor and a documented formula.

## 6. Functional modules
Add/edit/delete activities; calculation engine; calculation explanation; dashboard and charts; hotspot analysis; recommendations (AI + rules); what-if simulator; targets and progress; reports (CSV, printable/PDF); methodology and factors page.

## 7. Architecture and data flow
```
React (Vite) --HTTP/JSON--> Flask routes --> services --> calculations (pure Python)
                                  |                \--> emission_factors.json
                                  \--> SQLAlchemy --> SQLite (local) / PostgreSQL (prod)
Flask --(summary only)--> Gemini API  (optional; falls back to rules)
```
Flow: form -> `POST /api/activities` -> validate -> engine -> store activity + factor snapshot -> dashboard/analysis read stored values.

## 8. Technology stack
React 18, Vite, React Router, Recharts, Lucide icons; Python, Flask, Flask-CORS, Flask-SQLAlchemy; SQLite/PostgreSQL; Gemini API (optional); Vercel and Render.

## 9. Folder structure
```
ecotrack-ai/
  backend/  app/{__init__,main,config,database,models,seed_demo}.py
            app/calculations/ (engine, explain, factors)   app/services/   app/routes/api.py
            app/data/emission_factors.json   app/tests/   requirements.txt  render.yaml  .env.example
  frontend/ src/{components,pages,layouts,services,hooks,utils}  App.jsx  main.jsx
            package.json  vite.config.js  vercel.json  .env.example
  docs/     calculation-methodology.md  emission-factors.md  deployment-guide.md
```

## 10. Database design
`activities` (inputs, factor key/value/unit/version/source, emissions_kg, calculation snapshot JSON, timestamps, indexes on category and date, CHECK constraints) - `emission_factors` - `targets` - `scenarios` - `recommendations`. No login system is implemented, so the app is single-user.

## 11. API overview (all under `/api`)
`GET /health` - `GET /factors` - `POST /calculate` (preview) - `GET|POST /activities` - `GET|PUT|DELETE /activities/<id>` - `GET /activities/<id>/calculation` - `GET /dashboard` - `GET /analytics/categories` - `GET /hotspot` - `GET /recommendations` - `POST /simulate` - `GET|POST /scenarios` - `GET|POST /targets` - `GET /targets/progress` - `GET /reports/summary` - `GET /reports/activities.csv` - `GET /reports/summary.csv` - `GET /reports/printable` - `POST|DELETE /demo-data`.
Errors return `{"error": "message"}` with 400, 404 or 500.

## 12. Run locally on Windows (PowerShell)

Prerequisites: Python 3.10+ (tick "Add python.exe to PATH"), Node.js LTS 18+, VS Code. Check with:
```powershell
python --version
node --version
npm --version
```
Open the `ecotrack-ai` folder in VS Code (File > Open Folder), then open **two terminals** (Terminal > New Terminal).

**Terminal 1 - backend**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m app.seed_demo        # optional: loads demo data (creates the database)
python -m app.main
```
The API runs at http://127.0.0.1:5000 (check http://127.0.0.1:5000/api/health). The SQLite file is created at `backend/ecotrack.db`.

**Terminal 2 - frontend**
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```
Open http://localhost:5173.

### Common errors
| Problem | Fix |
|---|---|
| `Activate.ps1 cannot be loaded ... running scripts is disabled` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then activate again |
| `python` not recognised | Reinstall Python with PATH ticked, or use `py -m venv .venv` |
| `Cannot reach the server` in the browser | Backend not running, or `VITE_API_URL` wrong. Restart `npm run dev` after editing `.env` |
| CORS error in console | Add your frontend origin to `CORS_ORIGINS` in `backend/.env`, restart Flask |
| `Port 5000 is in use` | Set `$env:PORT=5001; python -m app.main` and set `VITE_API_URL=http://127.0.0.1:5001/api` |
| `psycopg2` install fails | Upgrade pip: `python -m pip install --upgrade pip` |

### Try each feature
1. **Home** shows a live sample calculation. 2. **Add activity**: save 100 kWh electricity; you land on the 8-step calculation. 3. **History**: edit, delete, "View calculation details". 4. **Dashboard**: load demo data, change date and category filters. 5. **Emission analysis**: hotspot and explanation. 6. **Recommendations**: calculated savings (add `GEMINI_API_KEY` in `backend/.env` for AI wording). 7. **What-if simulator**: run two scenarios and compare. 8. **Targets**: save a target, view progress. 9. **Reports**: download CSV, open printable report and print to PDF. 10. **Methodology**: factor table with sources.

## 13. Testing
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -v
```
37 tests cover each calculation category, unit conversion, invalid and zero inputs, CRUD, explanation values, dashboard totals, previous-period change, targets, what-if scenarios (and that they leave records unchanged), AI fallback, reports and demo data. Frontend build check: `cd frontend; npm run build`.

## 14. Deployment
See `docs/deployment-guide.md` (Vercel + Render + PostgreSQL). Not deployed by this repository; verify after you deploy.

## 15. Expected outputs
Dashboard with donut, bar, trend and target-vs-actual charts; 8-step calculation page per record; hotspot; recommendations; simulator comparison; progress tracker; CSV and printable reports.

## 16. Limitations and future work
Illustrative factors; single user (no authentication); no schema migrations; PDF via browser print; simple occupancy model; add Flask-Migrate, user accounts, more regions/years, and verified factor imports.
