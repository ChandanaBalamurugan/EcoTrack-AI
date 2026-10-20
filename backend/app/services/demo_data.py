import random
from datetime import date, timedelta

from ..database import db
from ..models import Activity, Scenario, Target
from .activity_service import create_activity


def clear_all():
    for model in (Activity, Target, Scenario):
        model.query.delete()
    db.session.commit()


def load_demo():
    """Deterministic demo data covering roughly the last 150 days."""
    rnd = random.Random(7)
    today = date.today()
    n = 0
    for i in range(150, -1, -1):
        d = today - timedelta(days=i)
        recent = i < 60  # a slightly lower footprint recently so progress charts are interesting
        items = []
        if d.day in (1, 15):
            items.append({"category": "electricity", "quantity": rnd.randint(140, 190) * (0.85 if recent else 1), "region": "IN"})
        if d.weekday() < 5:
            if recent and rnd.random() < 0.4:
                items.append({"category": "transport", "subtype": "bus", "quantity": rnd.randint(8, 18)})
            else:
                items.append({"category": "transport", "subtype": "car", "method": "petrol", "quantity": rnd.randint(10, 35), "occupancy": rnd.choice([1, 1, 2])})
        if d.day in (3, 18):
            items.append({"category": "fuel", "subtype": "petrol", "unit": "L", "quantity": rnd.randint(8, 20)})
        if d.weekday() == 6:
            items.append({"category": "waste", "subtype": "food", "method": "composting" if recent else "landfill", "quantity": round(rnd.uniform(1.5, 4), 1)})
        if d.day == 10:
            items.append({"category": "fuel", "subtype": "lpg", "unit": "kg", "quantity": 14.2})
        for it in items:
            it["activity_date"] = d.isoformat()
            it["quantity"] = round(it["quantity"], 2)
            create_activity(it)
            n += 1
    base_end = today - timedelta(days=60)
    db.session.add(Target(baseline_start=base_end - timedelta(days=59), baseline_end=base_end,
                          reduction_percent=15, target_date=today + timedelta(days=90)))
    db.session.commit()
    return n
