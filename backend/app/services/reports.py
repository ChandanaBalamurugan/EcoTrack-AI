import csv
import html
import io
from datetime import date

from ..calculations import factors as F
from ..calculations.engine import CATEGORIES
from ..models import Activity
from .analytics import dashboard, hotspot
from .recommendations import build_rules
from .targets import current_target, progress

ACTIVITY_COLUMNS = ["id", "activity_date", "category", "subtype", "method", "region", "quantity", "unit", "occupancy",
                    "factor_value", "factor_unit", "factor_version", "factor_source", "emissions_kg", "notes"]


def activities_csv(s, e):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(ACTIVITY_COLUMNS)
    q = Activity.query.filter(Activity.activity_date >= s, Activity.activity_date <= e).order_by(Activity.activity_date)
    for a in q:
        d = a.to_dict()
        w.writerow([d[c] if d[c] is not None else "" for c in ACTIVITY_COLUMNS])
    return buf.getvalue()


def year_summary(year):
    d = dashboard(date(year, 1, 1), date(year, 12, 31))
    return {"year": year, "total_kg": d["total_kg"], "by_category": d["by_category"], "monthly": d["monthly"],
            "activity_count": d["activity_count"]}


def summary_csv(year):
    ys = year_summary(year)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["month", *CATEGORIES, "total_kg"])
    for m in ys["monthly"]:
        w.writerow([m["month"], *[m[c] for c in CATEGORIES], m["total"]])
    w.writerow([])
    w.writerow(["category", "kg_co2e", "percent"])
    for r in ys["by_category"]:
        w.writerow([r["category"], r["kg"], r["percent"]])
    w.writerow(["TOTAL", ys["total_kg"], ""])
    return buf.getvalue()


def printable_html(s, e):
    esc = html.escape
    d, h = dashboard(s, e), hotspot(s, e)
    rows = "".join(f"<tr><td>{esc(r['category'].title())}</td><td>{r['kg']}</td><td>{r['percent']}%</td></tr>" for r in d["by_category"])
    acts = "".join(
        f"<tr><td>{a.activity_date}</td><td>{esc(a.category)}</td><td>{a.quantity:g} {esc(a.unit)}</td>"
        f"<td>{a.factor_value:g} {esc(a.factor_unit)}</td><td>{a.emissions_kg:.4f}</td></tr>"
        for a in Activity.query.filter(Activity.activity_date >= s, Activity.activity_date <= e).order_by(Activity.activity_date))
    facs = "".join(f"<tr><td>{esc(f['label'])}</td><td>{f['value']} {esc(f['unit'])}</td><td>{f['year']}</td>"
                   f"<td>{esc(f['source'])}</td><td>{esc(f['boundary'])}</td></tr>" for f in F.all_factors())
    t = current_target()
    tp = progress(t) if t else None
    target_html = "<p>No reduction target set.</p>"
    if tp and tp.get("baseline_kg"):
        target_html = (f"<p>Baseline {tp['baseline_kg']} kg, target {tp.get('target_kg')} kg, "
                       f"status: <b>{esc(str(tp['status']).replace('_', ' '))}</b>, progress {tp.get('progress_percent', 0)}%.</p>")
    recs = build_rules(s, e)
    rec_html = "".join(f"<li><b>{esc(r['title'])}</b>: about {r['reduction_kg']} kg CO2e over the period.</li>" for r in recs["recommendations"]) \
        or f"<li>{esc(recs['message'] or 'None')}</li>"
    hot = esc(h.get("explanation", h.get("message", "")))
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>EcoTrack AI report {s} to {e}</title>
<style>body{{font-family:Arial,sans-serif;max-width:900px;margin:24px auto;color:#14301f;padding:0 16px}}
h1,h2{{color:#14532d}}table{{border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:13px}}
td,th{{border:1px solid #bbd5c2;padding:6px;text-align:left}}th{{background:#e8f5ec}}.note{{background:#fff7e0;padding:10px;border:1px solid #e6cf85}}
@media print{{button{{display:none}}}}</style></head><body>
<button onclick="window.print()">Print or save as PDF</button>
<h1>EcoTrack AI - Carbon footprint report</h1>
<p>Reporting period: <b>{s}</b> to <b>{e}</b> ({d['period']['days']} days). Total: <b>{d['total_kg']} kg CO2e</b> ({d['total_tonnes']} t).</p>
<h2>Category breakdown</h2><table><tr><th>Category</th><th>kg CO2e</th><th>Share</th></tr>{rows}</table>
<h2>Hotspot</h2><p>{hot}</p>
<h2>Target progress</h2>{target_html}
<h2>Recommendations</h2><ul>{rec_html}</ul>
<h2>Activity history and calculations</h2><p>Formula: Emissions (kg CO2e) = Activity quantity x Emission factor.</p>
<table><tr><th>Date</th><th>Category</th><th>Quantity</th><th>Factor</th><th>kg CO2e</th></tr>{acts}</table>
<h2>Factor sources (dataset {esc(F.dataset_version())})</h2>
<table><tr><th>Factor</th><th>Value</th><th>Year</th><th>Source</th><th>Boundary</th></tr>{facs}</table>
<p class="note"><b>Limitations:</b> {esc(F.load()['notice'])} Results are estimates, not verified emissions.</p>
</body></html>"""
