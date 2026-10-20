from collections import defaultdict
from datetime import date, timedelta

from ..calculations.engine import CATEGORIES, CalculationError
from ..calculations.explain import pct
from ..models import Activity
from .activity_service import parse_date


def resolve_period(start=None, end=None):
    e = parse_date(end, "End date", required=False, allow_future=True) or date.today()
    s = parse_date(start, "Start date", required=False, allow_future=True) or e - timedelta(days=89)
    if s > e:
        raise CalculationError("Start date must not be after end date.")
    return s, e


def previous_period(s, e):
    days = (e - s).days + 1
    pe = s - timedelta(days=1)
    return pe - timedelta(days=days - 1), pe


def query(s, e, category=None):
    q = Activity.query.filter(Activity.activity_date >= s, Activity.activity_date <= e)
    if category:
        q = q.filter(Activity.category == category)
    return q


def category_totals(s, e, category=None):
    totals = {c: 0.0 for c in CATEGORIES}
    counts = {c: 0 for c in CATEGORIES}
    for a in query(s, e, category).all():
        totals[a.category] += a.emissions_kg
        counts[a.category] += 1
    return totals, counts


def total(s, e, category=None):
    return round(sum(category_totals(s, e, category)[0].values()), 6)


def label_of(a):
    parts = [a.category, (a.subtype or "").replace("_", " "), a.method or ""]
    return " / ".join(p for p in parts if p)


def activity_brief(a):
    return {"id": a.id, "label": label_of(a), "category": a.category, "date": a.activity_date.isoformat(),
            "quantity": a.quantity, "unit": a.unit, "emissions_kg": a.emissions_kg}


def dashboard(s, e, category=None):
    totals, counts = category_totals(s, e, category)
    grand = sum(totals.values())
    by_cat = [{"category": c, "kg": round(totals[c], 4), "percent": pct(totals[c], grand), "count": counts[c]}
              for c in CATEGORIES]
    ps, pe = previous_period(s, e)
    prev = total(ps, pe, category)
    acts = query(s, e, category).order_by(Activity.activity_date).all()
    monthly, daily = defaultdict(lambda: {c: 0.0 for c in CATEGORIES}), defaultdict(float)
    for a in acts:
        monthly[a.activity_date.strftime("%Y-%m")][a.category] += a.emissions_kg
        daily[a.activity_date.isoformat()] += a.emissions_kg
    top_cat = max(by_cat, key=lambda r: r["kg"]) if grand > 0 else None
    top_act = max(acts, key=lambda a: a.emissions_kg) if acts and grand > 0 else None
    return {
        "period": {"start": s.isoformat(), "end": e.isoformat(), "days": (e - s).days + 1},
        "previous_period": {"start": ps.isoformat(), "end": pe.isoformat(), "total_kg": round(prev, 4)},
        "filters": {"category": category},
        "activity_count": len(acts), "total_kg": round(grand, 4), "total_tonnes": round(grand / 1000, 6),
        "by_category": by_cat,
        "change_kg": round(grand - prev, 4),
        "change_percent": round((grand - prev) / prev * 100, 2) if prev else None,
        "monthly": [dict({"month": m}, total=round(sum(v.values()), 4), **{c: round(v[c], 4) for c in CATEGORIES})
                    for m, v in sorted(monthly.items())],
        "daily": [{"date": d, "total": round(v, 4)} for d, v in sorted(daily.items())],
        "top_category": top_cat, "top_activity": activity_brief(top_act) if top_act else None,
    }


def hotspot(s, e):
    d = dashboard(s, e)
    if d["total_kg"] <= 0:
        return {"has_data": False, "period": d["period"], "message": "Add some activities in this period to find your emission hotspot."}
    top = d["top_category"]
    prev_totals, _ = category_totals(*previous_period(s, e))
    prev_cat = prev_totals[top["category"]]
    best = (query(s, e, top["category"]).order_by(Activity.emissions_kg.desc()).first())
    ranking = sorted(d["by_category"], key=lambda r: r["kg"], reverse=True)
    explanation = (
        f"We added up the calculated emissions of all {d['activity_count']} activities between {s} and {e}. "
        f"{top['category'].title()} has the largest sum ({top['kg']} kg CO2e), which is {top['percent']}% of your "
        f"total of {d['total_kg']} kg CO2e. Biggest single record in that category: "
        f"{label_of(best)} on {best.activity_date} ({round(best.emissions_kg, 4)} kg CO2e).")
    return {
        "has_data": True, "period": d["period"], "category": top["category"], "category_kg": top["kg"],
        "percent": top["percent"], "ranking": ranking, "top_activity": activity_brief(best),
        "previous_category_kg": round(prev_cat, 4),
        "change_percent": round((top["kg"] - prev_cat) / prev_cat * 100, 2) if prev_cat else None,
        "explanation": explanation,
    }
