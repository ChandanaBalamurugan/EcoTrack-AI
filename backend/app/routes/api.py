import json
from datetime import date

from flask import Blueprint, Response, current_app, jsonify, request

from ..calculations import factors as F
from ..calculations.engine import CalculationError, calculate
from ..calculations.explain import build_explanation
from ..database import db
from ..models import Activity, EmissionFactor, Recommendation, Scenario, Target
from ..services import activity_service, analytics, demo_data, recommendations, reports, simulator, targets

bp = Blueprint("api", __name__, url_prefix="/api")


def _period():
    s, e = analytics.resolve_period(request.args.get("start"), request.args.get("end"))
    return s, e


def _json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise CalculationError("Request body must be valid JSON.")
    return data


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "time": date.today().isoformat(), "factor_version": F.dataset_version()})


@bp.get("/factors")
def factors():
    rows = EmissionFactor.query.order_by(EmissionFactor.category, EmissionFactor.key).all()
    return jsonify({"version": F.dataset_version(), "notice": F.load()["notice"], "factors": [r.to_dict() for r in rows]})


@bp.post("/calculate")
def preview():
    d = _json_body()
    return jsonify(calculate(d.get("category"), d.get("quantity"), d.get("unit") or None, d.get("subtype") or None,
                             d.get("method") or None, d.get("region") or None, d.get("occupancy", 1)))


@bp.get("/activities")
def list_activities():
    s, e = _period() if request.args.get("start") or request.args.get("end") else (date(1970, 1, 1), date(2999, 1, 1))
    q = analytics.query(s, e, request.args.get("category") or None).order_by(Activity.activity_date.desc(), Activity.id.desc())
    return jsonify({"activities": [a.to_dict() for a in q.all()]})


@bp.post("/activities")
def add_activity():
    return jsonify(activity_service.create_activity(_json_body()).to_dict()), 201


@bp.get("/activities/<int:aid>")
def get_activity(aid):
    return jsonify(db.get_or_404(Activity, aid).to_dict())


@bp.put("/activities/<int:aid>")
def edit_activity(aid):
    act = db.get_or_404(Activity, aid)
    return jsonify(activity_service.update_activity(act, _json_body()).to_dict())


@bp.delete("/activities/<int:aid>")
def remove_activity(aid):
    activity_service.delete_activity(db.get_or_404(Activity, aid))
    return "", 204


@bp.get("/activities/<int:aid>/calculation")
def calculation(aid):
    act = db.get_or_404(Activity, aid)
    d = act.activity_date
    ms, me = d.replace(day=1), (d.replace(month=12, day=31) if d.month == 12 else d.replace(month=d.month + 1, day=1) - __import__("datetime").timedelta(days=1))
    totals, _ = analytics.category_totals(ms, me)
    label = f"{ms.strftime('%B %Y')} (calendar month of the activity)"
    return jsonify(build_explanation(act.to_dict(), act.calc(), totals[act.category], sum(totals.values()), label))


@bp.get("/dashboard")
def dashboard():
    s, e = _period()
    out = analytics.dashboard(s, e, request.args.get("category") or None)
    t = targets.current_target()
    out["target"] = targets.progress(t) if t else None
    return jsonify(out)


@bp.get("/analytics/categories")
def categories():
    s, e = _period()
    return jsonify(analytics.dashboard(s, e, request.args.get("category") or None)["by_category"])


@bp.get("/hotspot")
def hotspot():
    s, e = _period()
    out = analytics.hotspot(s, e)
    if out["has_data"]:
        rules = recommendations.build_rules(s, e)
        out["opportunities"] = [{"title": r["title"], "reduction_kg": r["reduction_kg"]} for r in rules["recommendations"]]
    return jsonify(out)


@bp.get("/recommendations")
def recs():
    s, e = _period()
    cfg = current_app.config
    out = recommendations.recommend(s, e, cfg.get("GEMINI_API_KEY", ""), cfg.get("GEMINI_MODEL", ""))
    if out["sufficient"]:
        db.session.add(Recommendation(source=out["source"], payload=json.dumps(out)))
        db.session.commit()
    return jsonify(out)


@bp.post("/simulate")
def simulate():
    d = _json_body()
    s, e = analytics.resolve_period(d.get("start"), d.get("end"))
    return jsonify({"period": {"start": s.isoformat(), "end": e.isoformat()},
                    "results": simulator.simulate_many(d.get("scenarios"), s, e)})


@bp.get("/scenarios")
def list_scenarios():
    return jsonify({"scenarios": [x.to_dict() for x in Scenario.query.order_by(Scenario.id.desc()).limit(20)]})


@bp.post("/scenarios")
def save_scenario():
    d = _json_body()
    name = (d.get("name") or "").strip()[:120]
    if not name:
        raise CalculationError("Give the scenario a name.")
    sc = Scenario(name=name, payload=json.dumps(d.get("scenarios", [])), result=json.dumps(d.get("results", [])))
    db.session.add(sc)
    db.session.commit()
    return jsonify(sc.to_dict()), 201


@bp.delete("/scenarios/<int:sid>")
def delete_scenario(sid):
    db.session.delete(db.get_or_404(Scenario, sid))
    db.session.commit()
    return "", 204


@bp.get("/targets")
def list_targets():
    return jsonify({"targets": [t.to_dict() for t in Target.query.order_by(Target.id.desc())]})


@bp.post("/targets")
def add_target():
    return jsonify(targets.create_target(_json_body()).to_dict()), 201


@bp.delete("/targets/<int:tid>")
def delete_target(tid):
    db.session.delete(db.get_or_404(Target, tid))
    db.session.commit()
    return "", 204


@bp.get("/targets/progress")
def target_progress():
    t = targets.current_target()
    return jsonify(targets.progress(t) if t else {"target": None, "status": "no_target"})


@bp.get("/reports/summary")
def report_summary():
    year = int(request.args.get("year") or date.today().year)
    return jsonify(reports.year_summary(year))


@bp.get("/reports/activities.csv")
def report_activities_csv():
    s, e = _period()
    return Response(reports.activities_csv(s, e), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=ecotrack-activities.csv"})


@bp.get("/reports/summary.csv")
def report_summary_csv():
    year = int(request.args.get("year") or date.today().year)
    return Response(reports.summary_csv(year), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=ecotrack-summary-{year}.csv"})


@bp.get("/reports/printable")
def report_printable():
    s, e = _period()
    return Response(reports.printable_html(s, e), mimetype="text/html")


@bp.post("/demo-data")
def load_demo():
    return jsonify({"added": demo_data.load_demo()}), 201


@bp.delete("/demo-data")
def clear_demo():
    demo_data.clear_all()
    return "", 204
