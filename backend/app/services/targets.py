import calendar
from datetime import date, timedelta

from ..calculations.engine import CalculationError, check_quantity
from ..calculations.explain import pct
from ..database import db
from ..models import Target
from .activity_service import parse_date
from .analytics import total


def create_target(data):
    bs = parse_date(data.get("baseline_start"), "Baseline start", allow_future=True)
    be = parse_date(data.get("baseline_end"), "Baseline end", allow_future=True)
    td = parse_date(data.get("target_date"), "Target date", allow_future=True)
    if bs > be:
        raise CalculationError("Baseline start must not be after baseline end.")
    if td <= be:
        raise CalculationError("Target date must be after the baseline period ends.")
    rp, tk = data.get("reduction_percent"), data.get("target_emissions_kg")
    if rp in (None, "") and tk in (None, ""):
        raise CalculationError("Provide a reduction percentage or a target emissions level.")
    if rp not in (None, ""):
        rp = check_quantity(rp, "Reduction percentage")
        if not 0 < rp < 100:
            raise CalculationError("Reduction percentage must be between 0 and 100 (exclusive).")
        tk = None
    else:
        tk, rp = check_quantity(tk, "Target emissions"), None
    t = Target(baseline_start=bs, baseline_end=be, reduction_percent=rp, target_emissions_kg=tk, target_date=td)
    db.session.add(t)
    db.session.commit()
    return t


def current_target():
    return Target.query.order_by(Target.id.desc()).first()


def _months(start, end):
    cur = date(start.year, start.month, 1)
    while cur <= end:
        last = date(cur.year, cur.month, calendar.monthrange(cur.year, cur.month)[1])
        yield max(cur, start), min(last, end)
        cur = last + timedelta(days=1)


def progress(t, today=None):
    today = today or date.today()
    out = {"target": t.to_dict(), "note": "Changes reflect your recorded activity levels; they are not verified environmental impact."}
    base_days = (t.baseline_end - t.baseline_start).days + 1
    baseline = total(t.baseline_start, t.baseline_end)
    if baseline <= 0:
        out.update(status="no_baseline", message="No activities are recorded in the baseline period yet.", baseline_kg=0)
        return out
    target_kg = t.target_emissions_kg if t.target_emissions_kg is not None else baseline * (1 - t.reduction_percent / 100)
    needed = baseline - target_kg
    cur_end = min(today, t.target_date)
    elapsed = (cur_end - t.baseline_end).days
    out.update(baseline_kg=round(baseline, 4), target_kg=round(target_kg, 4), baseline_days=base_days,
               required_reduction_kg=round(needed, 4))
    if elapsed <= 0:
        out.update(status="not_started", current_kg=0, current_equivalent_kg=0, reduced_kg=0, progress_percent=0,
                   remaining_kg=round(max(needed, 0), 4), monthly=[],
                   message="The period after your baseline has not started yet.")
        return out
    cs = t.baseline_end + timedelta(days=1)
    current = total(cs, cur_end)
    equiv = current / elapsed * base_days  # same-length period so comparison is like-for-like
    reduced = baseline - equiv
    prog = max(0.0, min(100.0, reduced / needed * 100)) if needed > 0 else (100.0 if reduced >= 0 else 0.0)
    horizon = (t.target_date - t.baseline_end).days
    expected = needed * min(1.0, elapsed / horizon) if horizon else needed
    status = "achieved" if reduced >= needed else ("on_track" if reduced >= expected else "behind")
    rate = target_kg / base_days
    monthly = []
    for ms, me in _months(cs, cur_end):
        days = (me - ms).days + 1
        monthly.append({"month": ms.strftime("%Y-%m"), "actual_kg": round(total(ms, me), 4),
                        "target_kg": round(rate * days, 4), "days": days})
    out.update(status=status, current_kg=round(current, 4), current_equivalent_kg=round(equiv, 4),
               reduced_kg=round(reduced, 4), reduced_percent=pct(reduced, baseline), progress_percent=round(prog, 1),
               remaining_kg=round(max(0.0, needed - reduced), 4), days_elapsed=elapsed, monthly=monthly,
               message=None)
    return out
