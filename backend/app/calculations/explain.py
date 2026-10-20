"""Builds the 8-step calculation explanation from a stored calculation snapshot."""
from .engine import num

CATEGORY_LABEL = {"electricity": "Electricity", "transport": "Transportation", "fuel": "Fuel", "waste": "Waste"}


def pct(part, total):
    return round(part / total * 100, 2) if total else 0.0


def build_explanation(activity, calc, category_total, overall_total, period_label):
    """activity: dict of saved fields; calc: saved snapshot; totals are kg CO2e for the period."""
    e = calc["emissions_kg"]
    inputs = [
        {"label": "Activity type", "value": CATEGORY_LABEL[calc["category"]]},
        {"label": "Quantity", "value": f"{num(calc['input_quantity'])} {calc['input_unit']}"},
        {"label": "Date", "value": activity["activity_date"]},
    ]
    if calc.get("subtype"):
        inputs.append({"label": "Type", "value": str(calc["subtype"]).replace("_", " ")})
    if calc.get("method"):
        inputs.append({"label": "Fuel subtype / disposal method", "value": str(calc["method"])})
    if calc.get("region"):
        inputs.append({"label": "Grid region", "value": calc["region"]})
    if calc.get("occupancy"):
        inputs.append({"label": "Occupants sharing the vehicle", "value": str(calc["occupancy"])})
    if activity.get("period_start"):
        inputs.append({"label": "Reporting period", "value": f"{activity['period_start']} to {activity['period_end']}"})

    factor_items = [
        {"label": "Selected factor", "value": f"{num(calc['emission_factor'])} {calc['factor_unit']} ({calc['factor_label']})"},
        {"label": "Applies to", "value": calc["factor_region"]},
        {"label": "Reporting year", "value": str(calc["factor_year"])},
        {"label": "Dataset version", "value": calc["factor_version"]},
        {"label": "Boundary", "value": calc["boundary"]},
        {"label": "Source", "value": calc["source"], "url": calc["source_url"]},
    ]
    if calc["illustrative"]:
        factor_items.append({"label": "Status", "value": "ILLUSTRATIVE classroom value, not an official figure. Verify with the source before real reporting."})

    steps = [
        {"step": 1, "title": "User input", "items": inputs},
        {"step": 2, "title": "Emission factor selection", "items": factor_items},
        {"step": 3, "title": "Formula", "text": calc["formula"]},
        {"step": 4, "title": "Substitution", "text": calc["substitution"]},
        {"step": 5, "title": "Arithmetic", "lines": calc["arithmetic"]},
        {"step": 6, "title": "Final result", "items": [
            {"label": "Emissions", "value": f"{num(e)} kg CO2e"},
            {"label": "Emissions (tonnes)", "value": f"{num(e / 1000)} t CO2e"}]},
        {"step": 7, "title": "Category contribution", "items": [
            {"label": "Reporting period", "value": period_label},
            {"label": f"{CATEGORY_LABEL[calc['category']]} total", "value": f"{num(category_total)} kg CO2e"},
            {"label": "Share of category", "value": f"{pct(e, category_total)}%"},
            {"label": "Overall footprint", "value": f"{num(overall_total)} kg CO2e"},
            {"label": "Share of overall footprint", "value": f"{pct(e, overall_total)}%"}]},
        {"step": 8, "title": "Source and limitations",
         "items": [{"label": "Source", "value": calc["source"], "url": calc["source_url"]},
                   {"label": "Factor version", "value": calc["factor_version"]}],
         "lines": calc["assumptions"] + calc["limitations"]},
    ]
    return {"activity_id": activity.get("id"), "emissions_kg": e, "emissions_tonnes": round(e / 1000, 9),
            "illustrative": calc["illustrative"], "steps": steps}
