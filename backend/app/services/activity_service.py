import json
from datetime import date, timedelta

from ..calculations.engine import CATEGORIES, CalculationError, calculate
from ..database import db
from ..models import Activity


def parse_date(value, name, required=True, allow_future=False):
    if value in (None, ""):
        if required:
            raise CalculationError(f"{name} is required.")
        return None
    try:
        d = date.fromisoformat(str(value)[:10])
    except ValueError:
        raise CalculationError(f"{name} must be a valid date (YYYY-MM-DD).")
    if not allow_future and d > date.today() + timedelta(days=1):
        raise CalculationError(f"{name} cannot be in the future.")
    return d


def parse_activity(data):
    """Validate a request body and return the model fields (including a fresh calculation)."""
    if not isinstance(data, dict):
        raise CalculationError("Request body must be a JSON object.")
    category = data.get("category")
    if category not in CATEGORIES:
        raise CalculationError(f"Category must be one of: {', '.join(CATEGORIES)}.")
    activity_date = parse_date(data.get("activity_date"), "Activity date")
    calc = calculate(category, data.get("quantity"), data.get("unit") or None, data.get("subtype") or None,
                     data.get("method") or None, data.get("region") or None, data.get("occupancy", 1))
    ps = pe = None
    if category == "electricity" and (data.get("period_start") or data.get("period_end")):
        ps = parse_date(data.get("period_start"), "Period start")
        pe = parse_date(data.get("period_end"), "Period end")
        if ps > pe:
            raise CalculationError("Period start must not be after period end.")
    notes = (data.get("notes") or "")[:255] or None
    return {
        "category": category, "subtype": calc["subtype"], "method": calc["method"], "region": calc["region"],
        "quantity": calc["input_quantity"], "unit": calc["input_unit"],
        "base_quantity": calc["base_quantity"], "base_unit": calc["base_unit"], "occupancy": calc["occupancy"],
        "activity_date": activity_date, "period_start": ps, "period_end": pe, "notes": notes,
        "factor_key": calc["factor_key"], "factor_value": calc["emission_factor"], "factor_unit": calc["factor_unit"],
        "factor_version": calc["factor_version"], "factor_source": calc["source"],
        "emissions_kg": calc["emissions_kg"], "snapshot": json.dumps(calc),
    }


def create_activity(data):
    act = Activity(**parse_activity(data))
    db.session.add(act)
    db.session.commit()
    return act


def update_activity(act, data):
    for key, value in parse_activity(data).items():
        setattr(act, key, value)
    db.session.commit()
    return act


def delete_activity(act):
    db.session.delete(act)
    db.session.commit()
