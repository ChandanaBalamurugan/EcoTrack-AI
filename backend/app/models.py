import json
from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Index

from .database import db


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EmissionFactor(db.Model):
    __tablename__ = "emission_factors"
    key = db.Column(db.String(80), primary_key=True)
    category = db.Column(db.String(20), nullable=False, index=True)
    label = db.Column(db.String(120), nullable=False)
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(40), nullable=False)
    region = db.Column(db.String(20))
    year = db.Column(db.Integer)
    version = db.Column(db.String(40), nullable=False)
    boundary = db.Column(db.Text)
    source = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(255))
    illustrative = db.Column(db.Boolean, default=True)
    subtype = db.Column(db.String(40))
    method = db.Column(db.String(40))

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Activity(db.Model):
    """One saved activity plus a snapshot of the calculation made when it was saved."""
    __tablename__ = "activities"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_activity_quantity_nonneg"),
        CheckConstraint("emissions_kg >= 0", name="ck_activity_emissions_nonneg"),
        Index("ix_activity_cat_date", "category", "activity_date"),
    )
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(20), nullable=False, index=True)
    subtype = db.Column(db.String(40))      # transport mode | fuel type | waste category
    method = db.Column(db.String(40))       # car fuel type | disposal method
    region = db.Column(db.String(20))       # grid region (electricity)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    base_quantity = db.Column(db.Float, nullable=False)
    base_unit = db.Column(db.String(20), nullable=False)
    occupancy = db.Column(db.Integer)
    activity_date = db.Column(db.Date, nullable=False, index=True)
    period_start = db.Column(db.Date)
    period_end = db.Column(db.Date)
    notes = db.Column(db.String(255))
    factor_key = db.Column(db.String(80), nullable=False)
    factor_value = db.Column(db.Float, nullable=False)
    factor_unit = db.Column(db.String(40), nullable=False)
    factor_version = db.Column(db.String(40), nullable=False)
    factor_source = db.Column(db.String(255), nullable=False)
    emissions_kg = db.Column(db.Float, nullable=False)
    snapshot = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    def calc(self):
        return json.loads(self.snapshot)

    def to_dict(self):
        return {
            "id": self.id, "category": self.category, "subtype": self.subtype, "method": self.method,
            "region": self.region, "quantity": self.quantity, "unit": self.unit, "occupancy": self.occupancy,
            "activity_date": self.activity_date.isoformat(),
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "notes": self.notes, "factor_key": self.factor_key, "factor_value": self.factor_value,
            "factor_unit": self.factor_unit, "factor_version": self.factor_version,
            "factor_source": self.factor_source, "emissions_kg": self.emissions_kg,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Target(db.Model):
    __tablename__ = "targets"
    id = db.Column(db.Integer, primary_key=True)
    baseline_start = db.Column(db.Date, nullable=False)
    baseline_end = db.Column(db.Date, nullable=False)
    reduction_percent = db.Column(db.Float)
    target_emissions_kg = db.Column(db.Float)
    target_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {"id": self.id, "baseline_start": self.baseline_start.isoformat(),
                "baseline_end": self.baseline_end.isoformat(), "reduction_percent": self.reduction_percent,
                "target_emissions_kg": self.target_emissions_kg, "target_date": self.target_date.isoformat(),
                "created_at": self.created_at.isoformat()}


class Scenario(db.Model):
    __tablename__ = "scenarios"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    payload = db.Column(db.Text, nullable=False)   # scenario definitions (JSON)
    result = db.Column(db.Text, nullable=False)    # computed results (JSON)
    created_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "payload": json.loads(self.payload),
                "result": json.loads(self.result), "created_at": self.created_at.isoformat()}


class Recommendation(db.Model):
    __tablename__ = "recommendations"
    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(20), nullable=False)  # "rule-based" or "gemini+rules"
    payload = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=_now)
