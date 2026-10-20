"""Rule-based recommendations (numbers come from the calculation engine). Gemini only adds wording."""
import json

import requests

from ..calculations.explain import pct
from .analytics import category_totals, query
from .simulator import simulate

MIN_ACTIVITIES = 3


def _rec(rid, title, reason, action, priority, difficulty, scenario, result, period_days):
    return {"id": rid, "title": title, "reason": reason, "action": action, "priority": priority,
            "difficulty": difficulty, "reduction_kg": result["reduction_kg"], "period": f"{period_days} days (selected period)",
            "annual_reduction_kg": result["annual_reduction_kg"], "assumptions": result["assumptions"], "formula": result["formula"]}


def build_rules(s, e):
    totals, counts = category_totals(s, e)
    grand = sum(totals.values())
    days = (e - s).days + 1
    if sum(counts.values()) < MIN_ACTIVITIES or grand <= 0:
        missing = [c for c, n in counts.items() if n == 0]
        return {"sufficient": False, "recommendations": [],
                "message": f"Add at least {MIN_ACTIVITIES} activities in this period for personalised advice. "
                           f"No records yet for: {', '.join(missing) if missing else 'none'}."}
    order = sorted(totals, key=totals.get, reverse=True)
    recs = []
    for rank, cat in enumerate(order):
        if totals[cat] <= 0:
            continue
        priority = ["High", "Medium", "Low", "Low"][rank]
        share = f"{cat.title()} makes up {pct(totals[cat], grand)}% of your footprint ({round(totals[cat], 1)} kg CO2e)."
        if cat == "electricity":
            sc = {"type": "reduce_electricity", "percent": 15}
            r = simulate(sc, s, e)
            recs.append(_rec("electricity-15", "Trim electricity use by 15%", share,
                             "Switch to LED lighting, set AC to 24-26 C, and unplug idle devices.", priority, "Easy", sc, r, days))
        elif cat == "transport":
            for mode in ("car", "motorcycle", "air"):
                if any(a.subtype == mode for a in query(s, e, "transport")):
                    sc = {"type": "shift_transport", "percent": 30, "from_mode": mode, "to_mode": "train_metro" if mode != "motorcycle" else "bus"}
                    r = simulate(sc, s, e)
                    recs.append(_rec(f"transport-{mode}", f"Move 30% of {mode.replace('_', ' ')} distance to public transport", share,
                                     f"Use {sc['to_mode'].replace('_', ' ')} for regular commutes instead of {mode}.", priority, "Medium", sc, r, days))
                    break
        elif cat == "fuel":
            sc = {"type": "reduce_fuel", "percent": 10}
            r = simulate(sc, s, e)
            recs.append(_rec("fuel-10", "Use 10% less fuel", share,
                             "Combine trips, maintain tyre pressure, and avoid idling.", priority, "Medium", sc, r, days))
        elif cat == "waste":
            for a in query(s, e, "waste"):
                for to in ("composting", "recycling"):
                    try:
                        sc = {"type": "change_waste", "waste_category": a.subtype, "from_method": a.method, "to_method": to}
                        if a.method == "landfill":
                            r = simulate(sc, s, e)
                            if r["reduction_kg"] > 0:
                                recs.append(_rec(f"waste-{a.subtype}", f"Send {a.subtype} waste to {to} instead of landfill", share,
                                                 f"Segregate {a.subtype} waste at source and use a {to} service.", priority, "Easy", sc, r, days))
                                raise StopIteration
                    except StopIteration:
                        break
                    except ValueError:
                        continue
                else:
                    continue
                break
    return {"sufficient": True, "recommendations": recs, "message": None}


def gemini_explanations(recs, summary, api_key, model):
    """Ask Gemini ONLY for short explanations. Savings numbers are never taken from the model."""
    prompt = ("You are a sustainability coach. For each recommendation write ONE friendly sentence (max 30 words) "
              "explaining why it helps this user. Do not state or change any numbers other than those provided. "
              'Reply as JSON: {"explanations": {"<id>": "<sentence>"}}.\n'
              + json.dumps({"footprint_summary": summary, "recommendations": [
                  {"id": r["id"], "title": r["title"], "reduction_kg": r["reduction_kg"]} for r in recs]}))
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    resp = requests.post(url, headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                         json={"contents": [{"parts": [{"text": prompt}]}],
                               "generationConfig": {"responseMimeType": "application/json"}}, timeout=15)
    resp.raise_for_status()
    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    data = json.loads(text)["explanations"]
    return {k: str(v) for k, v in data.items()}


def recommend(s, e, api_key="", model="", explain_fn=gemini_explanations):
    result = build_rules(s, e)
    result.update({"source": "rule-based", "ai_explanations": {}, "ai_status": "not configured"})
    if not result["sufficient"]:
        return result
    if api_key:
        totals, _ = category_totals(s, e)
        summary = {c: round(v, 1) for c, v in totals.items()}  # category totals only: no personal data
        try:
            result["ai_explanations"] = explain_fn(result["recommendations"], summary, api_key, model)
            result["source"], result["ai_status"] = "gemini+rules", "ok"
        except Exception:
            result["ai_status"] = "AI service unavailable; showing rule-based recommendations only."
    return result
