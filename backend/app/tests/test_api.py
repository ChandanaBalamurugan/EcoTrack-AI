from datetime import date, timedelta

import pytest

from app.services import recommendations

TODAY = date.today()


def d(days_ago):
    return (TODAY - timedelta(days=days_ago)).isoformat()


def add(client, **kw):
    body = {"category": "electricity", "quantity": 100, "unit": "kWh", "activity_date": d(1), "region": "IN"}
    body.update(kw)
    return client.post("/api/activities", json=body)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.get_json()["status"] == "ok"


def test_crud_and_recalculation(client):
    r = add(client)
    assert r.status_code == 201
    a = r.get_json()
    assert a["emissions_kg"] == pytest.approx(71.0)
    upd = client.put(f"/api/activities/{a['id']}", json={"category": "electricity", "quantity": 200, "unit": "kWh",
                                                         "activity_date": d(1), "region": "IN"})
    assert upd.get_json()["emissions_kg"] == pytest.approx(142.0)
    assert len(client.get("/api/activities").get_json()["activities"]) == 1
    assert client.delete(f"/api/activities/{a['id']}").status_code == 204
    assert client.get(f"/api/activities/{a['id']}").status_code == 404
    assert client.get("/api/dashboard").get_json()["total_kg"] == 0


@pytest.mark.parametrize("body", [
    {"quantity": -5}, {"quantity": "abc"}, {"quantity": None}, {"unit": "bogus"},
    {"category": "nonsense"}, {"activity_date": "2999-01-01"}, {"activity_date": "not-a-date"},
])
def test_validation_errors(client, body):
    r = add(client, **body)
    assert r.status_code == 400 and "error" in r.get_json()


def test_calculation_explanation_values(client):
    a = add(client, quantity=100).get_json()
    ex = client.get(f"/api/activities/{a['id']}/calculation").get_json()
    assert [s["step"] for s in ex["steps"]] == list(range(1, 9))
    assert ex["emissions_kg"] == pytest.approx(71.0)
    assert "100 x 0.71" in ex["steps"][3]["text"]
    contrib = {i["label"]: i["value"] for i in ex["steps"][6]["items"]}
    assert contrib["Share of category"] == "100.0%"


def test_dashboard_totals_empty_state_and_change(client):
    empty = client.get("/api/dashboard").get_json()
    assert empty["total_kg"] == 0 and empty["top_category"] is None and empty["change_percent"] is None
    add(client, quantity=100, activity_date=d(5))
    add(client, category="fuel", subtype="petrol", unit="L", quantity=10, activity_date=d(6))
    add(client, quantity=50, activity_date=d(100))  # lands in the previous equivalent period
    out = client.get("/api/dashboard").get_json()
    assert out["total_kg"] == pytest.approx(71 + 23.1)
    assert out["top_category"]["category"] == "electricity"
    assert sum(r["percent"] for r in out["by_category"]) == pytest.approx(100, abs=0.1)
    assert out["previous_period"]["total_kg"] == pytest.approx(35.5)
    assert out["change_percent"] == pytest.approx((94.1 - 35.5) / 35.5 * 100, abs=0.1)
    filtered = client.get("/api/dashboard?category=fuel").get_json()
    assert filtered["total_kg"] == pytest.approx(23.1)


def test_hotspot(client):
    assert client.get("/api/hotspot").get_json()["has_data"] is False
    add(client, quantity=100)
    add(client, category="fuel", subtype="petrol", unit="L", quantity=1)
    h = client.get("/api/hotspot").get_json()
    assert h["category"] == "electricity" and "activities" in h["explanation"]


def seed_mixed(client):
    add(client, quantity=200, activity_date=d(3))
    add(client, category="transport", subtype="car", method="petrol", unit="km", quantity=100, occupancy=1, activity_date=d(4))
    add(client, category="waste", subtype="food", method="landfill", quantity=10, unit="kg", activity_date=d(5))
    add(client, category="fuel", subtype="diesel", unit="L", quantity=20, activity_date=d(6))


def test_whatif_does_not_change_records(client):
    seed_mixed(client)
    before = client.get("/api/dashboard").get_json()["total_kg"]
    r = client.post("/api/simulate", json={"scenarios": [
        {"type": "reduce_electricity", "percent": 20},
        {"type": "shift_transport", "percent": 50, "from_mode": "car", "to_mode": "bus"},
        {"type": "change_waste", "waste_category": "food", "from_method": "landfill", "to_method": "composting"},
        {"type": "reduce_fuel", "percent": 10}]})
    res = r.get_json()["results"]
    assert res[0]["reduction_kg"] == pytest.approx(142 * 0.2)
    assert res[1]["reduction_kg"] == pytest.approx(17 * 0.5 - 100 * 0.5 * 0.09)
    assert res[2]["reduction_kg"] == pytest.approx(10 * (0.58 - 0.10))
    assert res[0]["annual_reduction_kg"] is None or res[0]["annual_reduction_kg"] > 0
    assert client.get("/api/dashboard").get_json()["total_kg"] == pytest.approx(before)
    bad = client.post("/api/simulate", json={"scenarios": [{"type": "reduce_electricity", "percent": 500}]})
    assert bad.status_code == 400


def test_annual_estimate_hidden_for_short_period(client):
    add(client, quantity=100, activity_date=d(1))
    r = client.post("/api/simulate", json={"start": d(3), "end": d(0), "scenarios": [{"type": "reduce_electricity", "percent": 10}]})
    assert r.get_json()["results"][0]["annual_reduction_kg"] is None


def test_targets_and_progress(client):
    assert client.get("/api/targets/progress").get_json()["status"] == "no_target"
    # baseline: 60..31 days ago (30 days) -> 300 kWh = 213 kg
    add(client, quantity=300, activity_date=d(45))
    bad = client.post("/api/targets", json={"baseline_start": d(60), "baseline_end": d(31), "reduction_percent": 150,
                                            "target_date": (TODAY + timedelta(days=30)).isoformat()})
    assert bad.status_code == 400
    ok = client.post("/api/targets", json={"baseline_start": d(60), "baseline_end": d(31), "reduction_percent": 20,
                                           "target_date": (TODAY + timedelta(days=30)).isoformat()})
    assert ok.status_code == 201
    add(client, quantity=60, activity_date=d(10))  # 42.6 kg over 31 days since baseline end
    p = client.get("/api/targets/progress").get_json()
    assert p["baseline_kg"] == pytest.approx(213)
    assert p["target_kg"] == pytest.approx(213 * 0.8)
    assert p["reduced_kg"] > 0 and p["status"] in ("achieved", "on_track")
    assert p["remaining_kg"] == pytest.approx(max(0, 213 * 0.2 - p["reduced_kg"]), abs=0.01)


def test_recommendations_fallback_and_insufficient_data(client):
    r = client.get("/api/recommendations").get_json()
    assert r["sufficient"] is False and "Add at least" in r["message"]
    seed_mixed(client)
    r = client.get("/api/recommendations").get_json()
    assert r["sufficient"] and r["source"] == "rule-based" and r["recommendations"]
    assert all(x["reduction_kg"] > 0 for x in r["recommendations"])


def test_ai_failure_falls_back_to_rules(app, client):
    seed_mixed(client)
    app.config["GEMINI_API_KEY"] = "fake-key"
    def boom(*a, **k):
        raise RuntimeError("down")
    with app.app_context():
        from app.services.analytics import resolve_period
        s, e = resolve_period()
        out = recommendations.recommend(s, e, "fake-key", "m", explain_fn=boom)
    assert out["source"] == "rule-based" and out["recommendations"] and "unavailable" in out["ai_status"]


def test_ai_numbers_never_come_from_model(app, client):
    seed_mixed(client)
    with app.app_context():
        from app.services.analytics import resolve_period
        s, e = resolve_period()
        plain = recommendations.recommend(s, e)
        ai = recommendations.recommend(s, e, "k", "m", explain_fn=lambda recs, *_: {r["id"]: "Great idea." for r in recs})
    assert ai["source"] == "gemini+rules"
    assert [r["reduction_kg"] for r in ai["recommendations"]] == [r["reduction_kg"] for r in plain["recommendations"]]


def test_reports_and_factors(client):
    seed_mixed(client)
    csv_text = client.get("/api/reports/activities.csv").data.decode()
    assert csv_text.splitlines()[0].startswith("id,activity_date") and len(csv_text.splitlines()) == 5
    assert "TOTAL" in client.get(f"/api/reports/summary.csv?year={TODAY.year}").data.decode()
    html = client.get("/api/reports/printable").data.decode()
    assert "Factor sources" in html and "Limitations" in html
    f = client.get("/api/factors").get_json()
    assert f["factors"] and all(x["source"] for x in f["factors"])


def test_demo_data_loads(client):
    assert client.post("/api/demo-data").status_code == 201
    out = client.get("/api/dashboard").get_json()
    assert out["total_kg"] > 0 and out["target"]["status"] in ("achieved", "on_track", "behind")
    assert client.delete("/api/demo-data").status_code == 204
