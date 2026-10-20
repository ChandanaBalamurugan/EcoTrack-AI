"""What-if simulator. Reads saved activities but never writes to them."""
from ..calculations import engine
from ..calculations.engine import CalculationError, check_quantity
from ..calculations.explain import pct
from .analytics import query


def _percent(sc, name="percent"):
    p = check_quantity(sc.get(name), "Percent")
    if p > 100:
        raise CalculationError("Percent cannot be more than 100.")
    return p


def _scale(baseline, simulated, period_days, category, name, formula, assumptions):
    reduction = round(baseline - simulated, 4)
    annual, note = None, "Annual estimate hidden: the selected period is shorter than 28 days, so it is not a defensible basis."
    if period_days >= 28 and baseline > 0:
        annual = round(reduction * 365 / period_days, 2)
        note = f"Annual estimate = reduction x 365 / {period_days} days. Assumes the same activity pattern repeats all year."
    return {"name": name, "category": category, "baseline_kg": round(baseline, 4), "simulated_kg": round(simulated, 4),
            "reduction_kg": reduction, "reduction_percent": pct(reduction, baseline), "formula": formula,
            "assumptions": assumptions, "annual_reduction_kg": annual, "annual_note": note}


def simulate(sc, s, e):
    kind, days = sc.get("type"), (e - s).days + 1
    if kind == "reduce_electricity":
        p = _percent(sc)
        base = sum(a.emissions_kg for a in query(s, e, "electricity"))
        return _scale(base, base * (1 - p / 100), days, "electricity", sc.get("name") or f"Cut electricity {p:g}%",
                      f"Simulated = Baseline x (1 - {p:g}/100)",
                      ["Electricity use falls by the same percentage on every record.", "Grid factor unchanged."])
    if kind == "reduce_fuel":
        p = _percent(sc)
        ft = sc.get("fuel_type") or None
        acts = [a for a in query(s, e, "fuel") if not ft or a.subtype == ft]
        base = sum(a.emissions_kg for a in acts)
        return _scale(base, base * (1 - p / 100), days, "fuel", sc.get("name") or f"Cut {ft or 'fuel'} {p:g}%",
                      f"Simulated = Baseline x (1 - {p:g}/100)",
                      ["Fuel burned falls by the same percentage.", f"Applies to: {ft or 'all fuels'}."])
    if kind == "shift_transport":
        p = _percent(sc)
        frm, to = sc.get("from_mode"), sc.get("to_mode")
        if frm not in ("car", "motorcycle", "air") or to not in ("bus", "train_metro"):
            raise CalculationError("Shift from car, motorcycle or air to bus or train_metro.")
        base = sim = 0.0
        for a in [a for a in query(s, e, "transport") if a.subtype == frm]:
            moved = a.base_quantity * p / 100
            new = engine.calculate_transport(moved, to)["emissions_kg"]
            base += a.emissions_kg
            sim += a.emissions_kg * (1 - p / 100) + new
        return _scale(base, sim, days, "transport", sc.get("name") or f"Shift {p:g}% of {frm} km to {to}",
                      f"Simulated = Baseline x (1 - {p:g}/100) + (Distance x {p:g}/100 x {to} factor)",
                      [f"{p:g}% of each {frm} trip's distance is travelled by {to} instead.",
                       "Per-person emissions; bus/train factor assumes average occupancy."])
    if kind == "change_waste":
        cat, frm, to = sc.get("waste_category"), sc.get("from_method"), sc.get("to_method")
        base = sim = 0.0
        engine.calculate_waste(0, cat, to)  # raises if no documented factor
        for a in [a for a in query(s, e, "waste") if a.subtype == cat and a.method == frm]:
            base += a.emissions_kg
            sim += engine.calculate_waste(a.base_quantity, cat, to)["emissions_kg"]
        return _scale(base, sim, days, "waste", sc.get("name") or f"{cat}: {frm} to {to}",
                      f"Simulated = Waste mass x {to} factor (instead of {frm})",
                      [f"All {cat} waste now handled by {to}.", "Avoided-emission credits are not counted."])
    raise CalculationError("Unknown scenario type.")


def simulate_many(scenarios, s, e):
    if not isinstance(scenarios, list) or not scenarios:
        raise CalculationError("Provide at least one scenario.")
    return [simulate(sc, s, e) for sc in scenarios[:6]]
